var I18n = require('i18n');
var Boom = require('@hapi/boom');
var Hoek = require('@hapi/hoek');
var acceptLanguageParser = require('accept-language-parser');
var _ = require('lodash');
var pkg = require('./package.json');

exports.extractDefaultLocale = function(allLocales){
  if (!allLocales) {
    throw new Error('No locales defined!');
  }
  if (allLocales.length === 0) {
    throw new Error('Locales array is empty!');
  }
  return allLocales[0];
};

function detectLocaleFromAcceptedLanguages(acceptedLanguages, localesSupported) {
  var acceptedLanguageCodes = acceptLanguageParser.parse(acceptedLanguages);
  var matchedLanguageFound = acceptedLanguageCodes.find(function (languageCode) {
    return localesSupported.includes(languageCode.code);
  });
  if (matchedLanguageFound) {
    var matchedLanguageCode = matchedLanguageFound.code;
    if (matchedLanguageFound.region && localesSupported.includes(matchedLanguageFound.code + '-' + matchedLanguageFound.region)) {
      return matchedLanguageFound.code + '-' + matchedLanguageFound.region;
    }
    return matchedLanguageFound.code;
  }
}

exports.plugin = {
  name: pkg.name,
  version: pkg.version,
  pkg: pkg ,
  register: function(server, options){
    var pluginOptions = options ? options : {};
    if (pluginOptions.languageHeaderField) {
      pluginOptions.languageHeaderField = pluginOptions.languageHeaderField.toLowerCase();
    }
    I18n.configure(pluginOptions);

    var defaultLocale = pluginOptions.defaultLocale || exports.extractDefaultLocale(pluginOptions.locales);

    if (!pluginOptions.locales) {
      throw Error('No locales defined!');
    }

    server.ext('onRequest', function (request, h) {
      request.i18n = {};
      I18n.init(request, request.i18n);
      request.i18n.setLocale(defaultLocale);
      return h.continue;
    });

    server.ext('onPreAuth', function (request, h) {
      if (request.params && request.params.languageCode) {
        if (_.includes(pluginOptions.locales, request.params.languageCode) == false) {
          throw Boom.notFound('No localization available for ' + request.params.languageCode);
        }
        request.i18n.setLocale(request.params.languageCode);
      } else if (pluginOptions.queryParameter && request.query && request.query[pluginOptions.queryParameter]) {
        if (_.includes(pluginOptions.locales, request.query[pluginOptions.queryParameter]) == false) {
          throw Boom.notFound('No localization available for ' + request.query[pluginOptions.queryParameter]);
        }
        request.i18n.setLocale(request.query[pluginOptions.queryParameter]);
      } else if (pluginOptions.languageHeaderField && request.headers[pluginOptions.languageHeaderField]) {
        var matchedLanguageCode = detectLocaleFromAcceptedLanguages(
            request.headers[pluginOptions.languageHeaderField],
            pluginOptions.locales
        );
        if (matchedLanguageCode) {
          request.i18n.setLocale(matchedLanguageCode);
        }
      }
      return h.continue;
    });

    server.ext('onPreResponse', function (request, h) {
      if (!request.i18n || !request.response) {
        return h.continue;
      }
      var response = request.response;

      if (Boom.isBoom(response)) {
        return h.continue;
      }

      if (response.variety === 'view') {
        response.source.context = Hoek.merge(response.source.context || {}, request.i18n);
        response.source.context.languageCode = request.i18n.getLocale();
      }
      return h.continue;
    });
  }
};
