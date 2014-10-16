fis-prepackager-concat v0.0.5
======================

> A fis plugin that concatenates files.

## Getting Started

If you haven't used [F.I.S](https://github.com/fex-team/fis), be sure to check out the [Getting Started](http://fis.baidu.com/docs/beginning/getting-started.html) guide, as it explains how to create a F.I.S plugin. And reading through [how does fis work](https://github.com/fex-team/fis/wiki/%E8%BF%90%E8%A1%8C%E5%8E%9F%E7%90%86) will help you understand a lot more. Once you're familiar with that process, you may install this plugin with this command:

#### installation

```shell
npm install -g fis-prepakcager-concat
```

#### configuration

Once the plugin has been installed, it may be enabled with some line of configuration in your `fis-conf.js` file at your fis project's root directory.

Like the following configuration, you can concatenate every `conf.json` in `/widget` except the one in `/widget/header`, the code is quite self explanatory:

```js
// add fis-prepackager-concat as a prepackager
fis.config.set('modules.prepackager', fis.config.get('modules.prepackager') + ',concat');

// configure some settings for this plugin
fis.config.set('settings.prepackager.concat', {
    files: {
        // file types
        json: {
            // placeholder identifiers
            conf: {
                include: /^\/widget\/.*\/(conf\.json)$/i,
                exclude: '/widget/header/conf.json'
            }
        },
        css: {
            icons: {
                include: /^\/widget\/.*\/(icon\.css)$/i,
                exclude: ['/widget/header/icon.css', 'widget/footer/icon.css']
            }
        },
        js: {
            all: {
                include: /^\/widget\/.*\/(snippet\.js)$/i 
            } 
        }
    }
});

```

#### placing placeholders

Let's just assume you want to concatenate files of `file_type` type, and you want to identify them as `placeholder_id`

In HtmlLike files:

```html
<!-- concat.file_type = placeholder_id -->
```

In CssLike files:

```css
@import url(concat.file_type.placeholder_id);
// NOTE the semicolon
```

In JsLike files:
```js
__concat.file_type('placeholder_id')
// or
__concat.file_type("placeholder_id")
// NOTE: no semicolon at the end
```

## Behind the scene

Basically, this plugin serves as a prepackager to replace the placeholders in other source files with the concatencated files' content. By doing that, it fails `fis release -w` when you write concatenating files because of the phase this plugin is in.

In prepackaging phase of fis, when fis is watching files with `fis release -w`, fis only release files that's been changed. So if files that have placeholders in it will not be released again even if the concatenating files are changed unless you changed them too. 

#### Workaround

You can work this around with two options:

* restart fis watching
* change files where the placeholders are in
