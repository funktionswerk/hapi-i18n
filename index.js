var I18n = require("i18n");
var Boom = require("boom");
var Hoek = require("hoek");
var _ = require("lodash");

exports.register = function (server, options) {

  var pluginOptions = {};
  if (options) {
    pluginOptions = options;
  }
  I18n.configure(pluginOptions);

  var defaultLocale = pluginOptions.defaultLocale || exports.extractDefaultLocale(pluginOptions.locales);

  if (!pluginOptions.locales) {
    throw Error("No locales defined!");
  }

  server.ext("onPreAuth", function (request, h) {
    request.i18n = {};
    I18n.init(request, request.i18n);
    request.i18n.setLocale(defaultLocale);
    if (request.params && request.params.languageCode) {
      if (_.includes(pluginOptions.locales, request.params.languageCode) == false) {
        //return reply(Boom.notFound("No localization available for " + request.params.languageCode));
        return h.continue;
      }
      request.i18n.setLocale(request.params.languageCode);
    } else if (pluginOptions.queryParameter && request.query && request.query[pluginOptions.queryParameter]) {
      if (_.includes(pluginOptions.locales, request.query[pluginOptions.queryParameter]) == false) {
        //return reply(Boom.notFound("No localization available for " + request.query[pluginOptions.queryParameter]));
        return h.continue;
      }
      request.i18n.setLocale(request.query[pluginOptions.queryParameter]);
    } else if (pluginOptions.languageHeaderField && request.headers[pluginOptions.languageHeaderField]) {
      var languageCode = request.headers[pluginOptions.languageHeaderField];
      if (languageCode) {
        request.i18n.setLocale(languageCode);
      }
    }
    return h.continue;
  });

  server.ext("onPreResponse", function (request, h) {
    if (!request.i18n || !request.response) {
      return h.continue;
    }
    var response = request.response;
    if (response.variety === 'view') {
      response.source.context = Hoek.merge(response.source.context || {}, request.i18n);
      response.source.context.languageCode = request.i18n.getLocale();
    }
    return h.continue;
  })

  //next();
};

exports.extractDefaultLocale = function (allLocales) {
  if (!allLocales) {
    throw new Error("No locales defined!");
  }
  if (allLocales.length === 0) {
    throw new Error("Locales array is empty!");
  }
  return allLocales[0];
};

exports.register.attributes = {
  pkg: require('./package.json')
};
