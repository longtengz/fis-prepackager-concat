/*
 * XXX
 * when does fis add md5 to fileNames?
 * Need to consider this or every time the file will have new md5, just because it's the result of the concat
 *
 */

'use strict';

module.exports = function(ret, conf, settings, opt) {

    // if no files to concat
    if (!settings.files) {
        return;
    }

    var concats = {},
        regExpRules = [],
        templateFiles = [],
        contents = {};

    var defaultSettings = {
        inline: false
    };

    var namespace = fis.config.get('namespace');

    var extend_object = function(obj) {
        var src, prop;
        for (var i = 1, length = arguments.length; i < length; i++) {
            src = arguments[i];
            for (prop in src) {
                if (Object.prototype.hasOwnProperty.call(src, prop)) {
                    obj[prop] = src[prop];
                }
            }
        }
        return obj;
    };

    // value is an object
    // and value.from is sure to be existed

    var formatConfig = function(id, value, type) {

        var separator;

        if (type === 'json') {
            separator = ',';
        } else if (type === 'css') {
            separator = '';
        }

        var obj = {separator: separator, type: type};

        if (fis.util.is(value.from, 'Array')) {
            concats[id] = extend_object(obj, defaultSettings, value);

        } else if (fis.util.is(value.from, 'String')) {

            concats[id] = extend_object(obj, defaultSettings, value, {from: [value.from]});

        } else if (fis.util.is(value.from, 'RegExp')) {

            concats[id] = extend_object(obj, defaultSettings, value, {from: []});

            regExpRules.push({
                id: id,
                regexp: value.from,
            });

        }
    };

    var _processFile = function(type, content) {
        return content;
    };


    if (opt.optimize) {
        _processFile = function(type, content) {
            fis.util.pipe('optimizer.' + type, function(processor, settings) {
                content = processor(content, null, settings);
            });
            return content;
        };
    }

    // format pairs
    fis.util.map(settings.files, function(fileType, value) {
        fis.util.map(settings.files[fileType], function(id, value) {
            if (fis.util.is(value, 'Object')) {
                if (value.from === void 0) {
                    return;
                }
                formatConfig(id, value, fileType);
            } else {
                formatConfig(id, {from: value}, fileType);
            }
        });
    });

    var i = 0;
    // find regExp matched files
    fis.util.map(ret.src, function(relativePath, srcFileObj) {
        i++;
        regExpRules.forEach(function(value) {
            if (value.regexp.test(relativePath)) {
                // use subpath
                concats[value.id].from.push(srcFileObj.subpath.replace(/^\//, ''));
            }
        });

        // some plugin also checks file.noMapJs !== false XXX
        if (srcFileObj.isHtmlLike) {
            templateFiles.push(srcFileObj);
        }
    });

    // concat files according to keys in concats
    fis.util.map(concats, function(id, value) {
        var concatContents = [];
        value.from.forEach(function(file) {
            // using subpath to refer fileObj
            var fileObj = ret.src['/' + file],
                content;

            if (fileObj) {
                content = fileObj.getContent();
                if (content.length) {
                    concatContents.push(content);
                }
            } else {
                fis.log.error('file ' + file + ' not existed');
            }
        });

        concatContents = concatContents.join(value.separator);

        // as for JSON type files, always put them into an array variable
        if (value.type === 'json') {
            // use makeArray to be the variable concatenated contents assigned to
            // might as well trim contents to exclude new lines
            concatContents = ';var ' + id + '=[' + concatContents + '];';
        }

        templateFiles.forEach(function(fileObj) {
            var placeholder = '<-- concat.' + value.type + ' = ' + id + ' -->';

            // replace the placeholder
            var tplContent = fileObj.getContent(),
                replacement;

            // if (!value.inline) {
            if (value.inline === 'not finished implementing' /* xxx */) {

                // if not inline, save concatenated file in static, and write file to concats.id
                // XXX problmes for releasing while watching
                // XXX and issues with packing

                var deployedRelativePath = id;

                if (value.type === 'json' || value.type === 'js') {
                    if (!/\.js$/.test(id)) {
                        deployedRelativePath += '.js';
                    }
                } else if (value.type === 'css') {
                    if (!/\.css$/.test(id)) {
                        deployedRelativePath += '.css';
                    }
                }

                var fileToBeDeployed = fis.file(fis.project.getProjectPath(), deployedRelativePath);

                // store this generated file in ret.src
                // which is in memory and being processed by fis now
                // and will later be used to pack and deploy,
                // since right now it's in prepackaging phase
                ret.pkg[fileToBeDeployed.subpath] = fileToBeDeployed;

                fileToBeDeployed.setContent(concatContents);

                // XXX where to deal with the hash thing?

                replacement = '{%require name="' + namespace + ':' + id + '"%}';

            } else {

                if (value.type === 'json') {

                    // content, file, conf
                    // file is not used in optimizer, but conf is
                    replacement = '<script type="text/javascript">' + _processFile('js', concatContents) + '</script>';

                } else if (value.type === 'css') {
                    replacement = '<style type="text/css">' + _processFile('css', concatContents) + '</style>';
                }
            }

            tplContent = tplContent.replace(placeholder, replacement);

            fileObj.setContent(tplContent);
        });

    });
};
