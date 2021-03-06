const Should = require('should');
const Hapi = require('@hapi/hapi');
const Joi = require('@hapi/joi');
const Path = require('path');
const Boom = require('boom');
const Locale = require('../');
const Vision = require('vision');
const Handlebars = require('handlebars');


const translateString_en = 'All\'s well that ends well.';
const translateString_en_GB = 'All\'s well that ends well (british version).';
const translateString_de = 'Ende gut, alles gut.';
const translateString_fr = 'Tout est bien qui finit bien.';

Handlebars.registerHelper('i18n',function(context){
  return this.__(context);
});

async function setupServer() {
  const serverOptions = {
    port: 8047
  };

  const server = new Hapi.Server(serverOptions);

  var doSomething = () => {
    return new Promise((resolve) => {
      var data = {
        rows: []
      };
      for (i = 1; i < 100; ++i) {
        data.rows.push(i);
      }
      var fs = require('fs');
      var fileName = Path.join(__dirname, 'database.json');
      fs.writeFile(fileName, JSON.stringify(data), function (err) {
        Should.not.exist(err);
        resolve();
      });
    });
  };

  server.route({
    method: 'GET',
    path: '/no/language-code/path/parameter',
    options: {
      handler: async function (request, h) {
        await doSomething();
        return {
          locale: request.i18n.getLocale(),
          message: request.i18n.__(translateString_en)
        };
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/{languageCode}/localized/resource',
    options: {
      handler: async function (request, h) {
        await doSomething();
        return ({
          locale: request.i18n.getLocale(),
          requestedLocale: request.params.languageCode,
          message: request.i18n.__(translateString_en)
        });
      }
    }
  });

  server.route({
    method: 'POST',
    path: '/{languageCode}/localized/validation',
    options: {
      handler: function () {
      },
      validate: {
        payload: Joi.object({
          param: Joi.string().required()
        }),
        failAction: (request, h, error) => {
          throw Boom.badRequest(request.i18n.__('Validation failed'));
        }
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/localized/with/headers',
    options: {
      handler: async function (request, h) {
        await doSomething();
        return ({
          locale: request.i18n.getLocale(),
          requestedLocale: request.headers['accept-language'],
          message: request.i18n.__(translateString_en)
        });
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/localized/with/query',
    options: {
      handler: async function (request, h) {
        await doSomething();
        return ({
          locale: request.i18n.getLocale(),
          requestedLocale: request.query['lang'],
          message: request.i18n.__(translateString_en)
        });
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/localized/with/empty',
    options: {
      handler: async function (request, h) {
        await doSomething();
        return ({
          locale: request.i18n.getLocale(),
          requestedLocale: request.query['lang'],
          message: request.i18n.__('')
        });
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/{languageCode}/localized/view',
    options: {
      handler: async function (request, h) {
        await doSomething();
        return h.view('test',{
          title: 'Hapi i18n handlebars test',
          message: 'All\'s well that ends well.',
          song: request.i18n.__n('%s bottles of beer on the wall.', 99),
          languageCode: request.params.languageCode
        });
      }
    }
  });

  return server;
}

async function startServer(server) {
  try {
    await server.register(Vision);
    server.views({
      engines: {
        html: require('handlebars'),
      },
      relativeTo: __dirname,
      path: __dirname + '/views',

    });
    await server.start();
  }
  catch (err) {
    console.log(err);
    process.exit(1);
  }
}

describe('Localization', function () {
  describe('Usage of locale in hapi', function () {
    let server;

    before(async () => {
      server = await setupServer();
      await startServer(server);
    });

    after(async () => {
      const err = await server.stop({ timeout: 5000 });
    });

    it('can be added as plugin', async () => {
      const i18n_options = {
        locales: ['de', 'en-GB', 'en', 'fr'],
        directory: __dirname + '/locales',
        languageHeaderField: 'Accept-language',
        queryParameter: 'lang'
      };
      await server.register({plugin: Locale, options:i18n_options});
    });

    it('extracts the default locale from the configured locales', () => {
      Should.throws(() => {
        Locale.extractDefaultLocale()
      }, Error);
      Should.throws(() => {
        Locale.extractDefaultLocale([])
      }, Error);
      Locale.extractDefaultLocale(['fr', 'de']).should.equal('fr');
    });

    it('uses the default locale if no language code path parameter is available', async () => {
      const response = await server.inject(
        {
          method: 'GET',
          url: '/no/language-code/path/parameter'
        })
      response.result.locale.should.equal('de');
      response.result.message.should.equal(translateString_de);
    });

    it('uses the requested locale if language code is provided', async () => {
      const response = await server.inject(
        {
          method: 'GET',
          url: '/fr/localized/resource'
        })
      response.result.locale.should.equal('fr');
      response.result.requestedLocale.should.equal('fr');
      response.result.message.should.equal(translateString_fr);
    });

    it('uses the requested locale if language code is provided in headers', async () => {
      let response = await server.inject(
        {
          method: 'GET',
          url: '/localized/with/headers',
          headers: {
            'accept-language': 'fr-CA,en-GB,en-US;q=0.9;q=0.7,en;q=0.8'
          }
        }
      );
      response.result.locale.should.equal('fr');
      response.result.requestedLocale.should.equal('fr-CA,en-GB,en-US;q=0.9;q=0.7,en;q=0.8');
      response.result.message.should.equal(translateString_fr);
      response = await server.inject(
          {
            method: 'GET',
            url: '/localized/with/headers',
            headers: {
              'Accept-Language': 'es,en-GB,en-US;q=0.9;q=0.7,en;q=0.8'
            }
          }
      );
      response.result.locale.should.equal('en-GB');
      response.result.message.should.equal(translateString_en_GB);
      response = await server.inject(
        {
          method: 'GET',
          url: '/localized/with/headers',
          headers: {}
        }
      );
      response.result.locale.should.equal('de');
      response.result.message.should.equal(translateString_de);
    });

    it('uses the default locale if language codes in header don\'t match', async () => {
      let response = await server.inject(
        {
          method: 'GET',
          url: '/localized/with/headers',
          headers: {
            'accept-language': 'es,it'
          }
        }
      );
      response.result.locale.should.equal('de');
      response.result.message.should.equal(translateString_de);
    });


    it('uses the language query parameter over the header parameter because this is more explicit', async () => {
      const response = await server.inject(
        {
          method: 'GET',
          url: '/localized/with/query?lang=fr'
        }
      );
      response.result.locale.should.equal('fr');
      response.result.requestedLocale.should.equal('fr');
      response.result.message.should.equal(translateString_fr);
    });

    it('should return an empty string with empty parameter', function () {
      return server.inject(
        {
          method: 'GET',
          url: '/localized/with/empty',
          headers: {
            'accept-language': 'fr'
          }
        })
        .then ( (response) => {
          response.result.locale.should.equal('fr');
          response.result.message.should.equal('');
        });
    });

    it('uses the language path parameter over the header parameter because this is more explicit', async () => {
      const response = await server.inject(
        {
          method: 'GET',
          url: '/fr/localized/resource',
          headers: {
            'accept-language': 'en'
          }
        }
      );
      response.result.locale.should.equal('fr');
      response.result.requestedLocale.should.equal('fr');
      response.result.message.should.equal(translateString_fr);
    });

    it('translates localized strings in handlebars templates', async () => {
      const response = await server.inject(
        {
          method: 'GET',
          url: '/fr/localized/view'
        }
      );
      response.statusCode.should.equal(200);
      response.result.should.equal('<!DOCTYPE html><html lang=fr><body><p>Tout est bien qui finit bien.</p><p>99 bouteilles de bière sur le mur.</p><p>Langue courante: <strong>fr</strong></p></body></html>\n');
    });

    it('returns status code NOT-FOUND if the requested locale is not available', async () => {
      const response = await server.inject(
        {
          method: 'GET',
          url: '/en-US/localized/resource'
        }
       );
        const payload = JSON.parse(response.payload);
        payload.statusCode.should.equal(404);
        payload.message.should.equal('No localization available for en-US');
    });

    it('allows other plugins to handle pre response', async () => {
      let otherPluginCalled = false;
      const otherPluginWithPreResponseHandling = {
        name: 'onPreResponseTest',
        register: function (server, options) {
          server.ext('onPreResponse', function (request, h) {
            otherPluginCalled = true;
            return h.continue;
          });
        }
      };
      await server.register({plugin: otherPluginWithPreResponseHandling});
      const response = await server.inject(
        {
          method: 'GET',
          url: '/en-US/localized/resource'
        }
      );
      const payload = JSON.parse(response.payload);
      payload.statusCode.should.equal(404);
      otherPluginCalled.should.be.true();
    });

    it('is available in the validation failAction handler ', async () => {
      const response = await server.inject(
        {
          method: 'POST',
          url: '/de/localized/validation'
        }
      );
      var payload = JSON.parse(response.payload);
      payload.statusCode.should.equal(400);
      payload.message.should.equal('Prüfung fehlgeschlagen');
    });



    it('must assure correct localization when processing requests concurrently', function (done) {
      var numIterations = 200;
      var numRequestsPerIteration = 3;
      var numProcessedRequests = 0;
      var numTotalRequests = numIterations * numRequestsPerIteration;
      var numErrorsWrongDefaultLocale = 0;
      var numErrorsWrongTranslation = 0;
      var numErrorsWrongRequestedLocale = 0;
      this.timeout(numTotalRequests * 10);
      for (iteration = 0; iteration < numIterations; ++iteration) {

        var onLastResponse = function () {
          numProcessedRequests.should.equal(numTotalRequests);
          numErrorsWrongDefaultLocale.should.equal(0);
          numErrorsWrongRequestedLocale.should.equal(0);
          done();
        };

        server.inject(
          {
            method: 'GET',
            url: '/no/language-code/path/parameter'
          })
          .then ( (response) => {
            if (response.result.locale !== 'de') {
              ++numErrorsWrongDefaultLocale;
            }
            if (response.result.message !== translateString_de) {
              ++numErrorsWrongTranslation;
            }
            ++numProcessedRequests;
            if (numProcessedRequests == numTotalRequests) {
              onLastResponse();
            }
          }
        );

        server.inject(
          {
            method: 'GET',
            url: '/en/localized/resource'
          })
          .then ( (response) => {
            if (response.result.locale !== 'en') {
              ++numErrorsWrongRequestedLocale;
            }
            if (response.result.message !== translateString_en) {
              ++numErrorsWrongTranslation;
            }
            response.result.requestedLocale.should.equal('en');
            ++numProcessedRequests;
            if (numProcessedRequests == numTotalRequests) {
              onLastResponse();
            }
          }
        );

        server.inject(
          {
            method: 'GET',
            url: '/fr/localized/resource'
          })
          .then ( (response) => {
            if (response.result.locale !== 'fr') {
              ++numErrorsWrongRequestedLocale;
            }
            response.result.requestedLocale.should.equal('fr');
            ++numProcessedRequests;
            if (numProcessedRequests == numTotalRequests) {
              onLastResponse();
            }
          }
        );
      }
    })

  });

  describe('with a custom 404 handler', () => {
    let server;

    before(async () => {
      server = await setupServer();

      const i18n_options = {
        locales: ['de', 'en-GB', 'en', 'fr'],
        directory: __dirname + '/locales',
        languageHeaderField: 'accept-language',
        queryParameter: 'lang'
      };
      await server.register({plugin: Locale, options:i18n_options});

      server.ext('onPreResponse', (request, h) => {
        const response = request.response;
        if (response.isBoom) {
          if (response.output.statusCode === 404) {
            return h.view('test',{
              title: 'Hapi i18n handlebars test',
              message: 'All\'s well that ends well.',
              song: request.i18n.__n('%s bottles of beer on the wall.', 99),
              languageCode: request.params.languageCode
            }).code(404);
          }
        }

        return h.continue;
      }, {before: 'hapi-i18n'});

      await startServer(server);
    });

    after(async () => {
      const err = await server.stop({ timeout: 5000 });
    });

    it('is still available when handling missing routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/does-not-exist'
      });
      response.statusCode.should.equal(404);
      should(response.result).startWith('<!DOCTYPE html><html lang=');
    });

  });

})
