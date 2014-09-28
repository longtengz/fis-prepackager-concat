'use strict';

exports = module.exports = function(ret, conf, settings, opt) {

    // if no files to concat
    if (!settings.files) {
        return;
    }

    var concats = {},
        regExpRules = [],
        concatContents = {},
        contents = {};

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
    // and value.include is sure to be existed

    var formatConfig = function(id, value, type) {

        var separator;

        if (type === 'json') {
            separator = ',';
        } else if (type === 'css') {
            separator = '';
        } else if (type === 'js') {
            separator = ';';
        }

        var obj = {separator: separator, type: type};

        if (fis.util.is(value.include, 'Array')) {
            concats[id] = extend_object(obj, value);

        } else if (fis.util.is(value.include, 'String')) {

            concats[id] = extend_object(obj, value, {include: [value.include]});

        } else if (fis.util.is(value.include, 'RegExp')) {

            concats[id] = extend_object(obj, value, {include: []});

            regExpRules.push({
                id: id,
                regexp: value.include,
            });

        }
    };

    var _processFile = function(content, type) {
        return content;
    };

    if (opt.optimize) {
        _processFile = function(content, type) {

            var processAs;

            if (type === 'json') {
                processAs = 'js';

                // to make JSON expression into a small program so that in uglify-js can parse it
                // Because we can't parse JSON since it's no valid JS
                // and we cannot parse expression in program
                // like we did in command line `uglifyjs --expr -o manifest.min.json manifest.json`
                content = '__concat_single_expression(' + content + ');';
            }

            fis.util.pipe('optimizer.' + processAs, function(processor, settings) {

                try {
                    content = processor(content, null, settings);
                } catch(e) {
                    fis.log.warning(e.message);
                    fis.log.error(e.stack);
                }

            });

            if (type === 'json') {
                content = content.replace('__concat_single_expression(', '');
                content = content.slice(0, -2);
            }

            return content;
        };
    }

    // format pairs
    fis.util.map(settings.files, function(fileType, value) {
        fis.util.map(settings.files[fileType], function(id, value) {
            if (fis.util.is(value, 'Object')) {
                if (value.include === void 0) {
                    return;
                }
                formatConfig(id, value, fileType);
            } else {
                formatConfig(id, {include: value}, fileType);
            }
        });
    });

    // find regExp matched files
    fis.util.map(ret.src, function(relativePath, srcFileObj) {
        regExpRules.forEach(function(value) {
            if (value.regexp.test(relativePath)) {
                // use subpath
                concats[value.id].include.push(srcFileObj.subpath.replace(/^\//, ''));
            }
        });
    });


    // concat files according to keys in concats
    fis.util.map(concats, function(id, value) {
        concatContents[id] = {
            placeholder: null,
            content: ''
        };

        var contents = [];

        value.include.forEach(function(file) {
            // using subpath to refer fileObj
            var fileObj = ret.src['/' + file],
                content;

            if (fileObj) {
                content = fileObj.getContent();
                if (content.length) {
                    contents.push(content);
                }
            } else {
                fis.log.error('file ' + file + ' not existed');
            }
        });

        // only files that are not css, js gets optimized like them
        // cuz the content in css, js src files were already optimized during compile phase
        if (value.type === 'js' || value.type === 'css') {
            concatContents[id].content = contents.join(value.separator);
        } else {
            concatContents[id].content = _processFile(contents.join(value.separator), value.type);
        }

        /*
         * if id === 'example', concat type === type
         *
         * JsLike placeholder === __concat.type('example') or __concat.type("example")
         * CssLike placeholder === @import url(concat.example);
         * HtmlLike placeholder === <!-- concat.type = example -->
         *
         */
        concatContents[id].placeholder = {
            js: new RegExp('__concat\\.' + value.type + '\\((?:"'+ id + '"|\'' + id + '\')\\)'),
            css: new RegExp('@import\\s+url\\((?:concat\\.'+ id + ')\\);'),
            html: '<!-- concat.' + value.type + ' = ' + id + ' -->'
        };
    });

    fis.util.map(ret.src, function(subpath, srcFileObj) {
        if (srcFileObj.isText()) {
            var content = srcFileObj.getContent();

            fis.util.map(concatContents, function(id, concat) {
                var placeholder;

                if (srcFileObj.isHtmlLike) {
                    placeholder = concat.placeholder.html;
                } else if (srcFileObj.isJsLike) {
                    placeholder = concat.placeholder.js;
                } else if (srcFileObj.isCssLike) {
                    placeholder = concat.placeholder.css;
                }

                content = content.replace(placeholder, concat.content);

            });

            srcFileObj.setContent(content);
        }
    });

};
