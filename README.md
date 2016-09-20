# hapi-i18n
Translation module for hapi based on mashpie's i18n module

## Installation
```
npm install hapi-i18n
```

## Usage

For details see the examples in the [mocha tests](test/test.js).

The i18n module is attached to the request object configured with the requested locale. This ensures that the correct locale is set for the request when processing multiple requests at the same time.

JavaScript example:
```js
function ( request, reply ){
  return reply({
    message: request.i18n.__( "My localized string" )
  });
});
```

Template example (Jade):
```
doctype html
html(lang=languageCode)
  body
    p!= __("My localized string")
    p!= __("hello", {name:"Manu"})
```

Template example (Nunjucks)
```
<p>{{ __("My localized string") }}</p>
<p>{{ __("hello", {name:"Manu"}) }}</p>
<p>{{ __("hello", name="Manu2") }}</p>
```

## Register Plugin

Basic configuration to define the supported locales and the directory to load the translation files from:

```js
server.register(
  {
    register: require( "hapi-i18n" ),
    options: {
      locales: ["de", "en", "fr"],
      directory: __dirname + "/locales"
    }
  },
  function ( err ){
    if ( err ){
      console.log( err );
    }
  }
);
```
The configuration options are passed directly to mashpie's i18n module. To get the full list of available options see [mashpie/i18n-node](https://github.com/mashpie/i18n-node). The default locale is the first locale found in the list, in this example "de".

As an alternative to the path parameter you can also read the language code from the request header:
```
server.register(
  {
    register: require( "hapi-i18n" ),
    options: {
      locales: ["de", "en", "fr"],
      directory: __dirname + "/locales",
      languageHeaderField: "language"
    }
  },
  function ( err ){
    if ( err ){
      console.log( err );
    }
  }
);
```

## Define Resources
The requested language is specified by a path parameter *languageCode* in your resource urls: 

```js
server.route({
  method: "GET",
  path: "/{languageCode}/my/localized/resource",
  handler: function ( request, reply ){
    return reply({
      message: request.i18n.__( "My localized string" )
    });
  }
});
```
Example request:
```
http://localhost/fr/my/localized/resource.
```
The language code is evaluated automatically. If a language code is found for the requested path parameter, the according locale is set. If the language code does not match any of configured language codes, the plugin returns 404 (NotFound).
