'use strict';

exports = module.exports = function(ret, conf, settings, opt) {

    // if no files to concat
    if (!settings.files) {
        return;
    }

    var concats = {},
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

    var separators = {
        json: ',',
        js: ';',
        css: ''
    };

    // find src files that match those rules with include and exclude
    fis.util.map(ret.src, function(subpath, srcFileObj) {
        fis.util.map(settings.files, function(fileType, rules) {
            fis.util.map(rules, function(name, obj) {
                if (!concats[fileType + ':' + name]) {
                    concats[fileType + ':' + name] = {
                        include: [],
                        type: fileType
                    };
                }
                if (fis.util.filter(subpath, obj.include, obj.exclude)) {
                    concats[fileType + ':' + name].include.push(subpath.replace(/^\//, ''));
                }
            });
        });
    });

    // concat files according to keys in concats
    fis.util.map(concats, function(name, value) {
        concatContents[name] = {
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
            concatContents[name].content = contents.join(separators[value.type]);
        } else {
            concatContents[name].content = _processFile(contents.join(separators[value.type]), value.type);
        }

        /*
         * if name === 'example', concat type === type
         *
         * JsLike placeholder === __concat.type('example') or __concat.type("example")
         * CssLike placeholder === @import url(concat.example);
         * HtmlLike placeholder === <!-- concat.type = example -->
         *
         */

        var nameId = name.split(':')[1];

        concatContents[name].placeholder = {
            js: new RegExp('__concat\\.' + value.type + '\\((?:"'+ nameId + '"|\'' + nameId + '\')\\)'),
            css: new RegExp('@import\\s+url\\((?:concat\\.' + value.type + '\\.' + nameId + ')\\);'),
            html: '<!-- concat.' + value.type + ' = ' + nameId + ' -->'
        };
    });

    fis.util.map(ret.src, function(subpath, srcFileObj) {
        if (srcFileObj.isText()) {
            var content = srcFileObj.getContent();

            fis.util.map(concatContents, function(name, concat) {
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
