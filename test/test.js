const Should = require("should");
const Hapi = require("hapi");
const Path = require("path");
const Joi = require("joi");
const Boom = require("boom");
const Locale = require("../");
const Vision = require('vision');
const Handlebars = require('handlebars');


const translateString_en = "All's well that ends well.";
const translateString_de = "Ende gut, alles gut.";
const translateString_fr = "Tout est bien qui finit bien.";

var server;

async function setupServer() {
  const serverOptions = {
    port: 8047
  };

  server = new Hapi.Server(serverOptions);

  server.route({
    method: "GET",
    path: "/no/language-code/path/parameter",
    options: {
      handler: function (request, h) {
        return (
          {
            locale: request.i18n.getLocale(),
            message: request.i18n.__(translateString_en)
          }
        );
      }
    }
  });

  server.route({
    method: "GET",
    path: "/{languageCode}/localized/resource",
    options: {
      handler: function (request, h) {
        return (
          {
            locale: request.i18n.getLocale(),
            requestedLocale: request.params.languageCode,
            message: request.i18n.__(translateString_en)
          }
        );
      }
    }
  });

  server.route({
    method: "POST",
    path: "/{languageCode}/localized/validation",
    options: {
      handler: function () {
      },
      validate: {
        payload: {
          param: Joi.string().required()
        },
        failAction: (request, h, error) => {
          throw Boom.badRequest(request.i18n.__("Validation failed"));
        }
      }
    }
  });

  server.route({
    method: "GET",
    path: "/localized/with/headers",
    options: {
      handler: function (request, h) {
        return (
          {
            locale: request.i18n.getLocale(),
            requestedLocale: request.headers["language"],
            message: request.i18n.__(translateString_en)
          }
        );
      }
    }
  });

  server.route({
    method: "GET",
    path: "/localized/with/query",
    options: {
      handler: function (request, h) {
        return (
          {
            locale: request.i18n.getLocale(),
            requestedLocale: request.query["lang"],
            message: request.i18n.__(translateString_en)
          }
        );
      }
    }
  });

  server.route({
    method: "GET",
    path: "/localized/with/empty",
    options: {
      handler: function (request, h) {
        return (
          {
            locale: request.i18n.getLocale(),
            requestedLocale: request.query["lang"],
            message: request.i18n.__("")
          }
        );
      }
    }
  });


  server.route({
    method: "GET",
    path: "/{languageCode}/localized/view",
    options: {
      handler: function (request, h) {
        Handlebars.registerHelper('i18n',function(context){
          return request.i18n.__(context);
        });
        return h.view("test",{
          title: 'Hapi i18n handlebars test',
          message: "All's well that ends well.",
          languageCode: request.params.languageCode
        })
      }
    }
  });

}

async function startServer() {
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

        console.log('Test Hapi server running at:', server.info.uri);

      }
      catch (err) {
        console.log(err);
        process.exit(1);
      }

}

before(function(done) {
  setupServer()
  .then (() => {
    startServer()
  })
  .then (() => {done()})
});

after(function() {
  server.stop({ timeout: 5000 }).then(function (err) {
    console.log('Test hapi server stopped');
    process.exit((err) ? 1 : 0);
  });
});

describe("Localization", function () {
  describe("Usage of locale in hapi", function () {


    var doSomething = function (cb) {
      var data = {
        rows: []
      }
      for (i = 1; i < 100; ++i) {
        data.rows.push(i);
      }
      var fs = require("fs");
      var fileName = Path.join(__dirname, "database.json");
      fs.writeFile(fileName, JSON.stringify(data), function (err) {
        Should.not.exist(err);
        cb();
      });
    }

    it("can be added as plugin", async function () {

      const i18n_options = {
        locales: ["de", "en", "fr"],
        directory: __dirname + "/locales",
        languageHeaderField: "language",
        queryParameter: "lang",
      }

      try {
        return await server.register({plugin: Locale, options:i18n_options});
      }
      catch (err) {
        Should.not.exist(err);
      }

    });

    it("extracts the default locale from the configured locales", function () {
      Should.throws(function () {
        Locale.extractDefaultLocale()
      }, Error);
      Should.throws(function () {
        Locale.extractDefaultLocale([])
      }, Error);
      Locale.extractDefaultLocale(["fr", "de"]).should.equal("fr");
    });

    it("uses the default locale if no language code path parameter is available", function () {
      return server.inject(
        {
          method: "GET",
          url: "/no/language-code/path/parameter"
        })
        .then ( (response) => {
          doSomething(function(){
            response.result.locale.should.equal("de");
            response.result.message.should.equal(translateString_de);
          });
        });
    });

    it("uses the requested locale if language code is provided", function () {
      return server.inject(
        {
          method: "GET",
          url: "/fr/localized/resource"
        })
        .then( (response) => {
          response.result.locale.should.equal("fr");
          response.result.requestedLocale.should.equal("fr");
          response.result.message.should.equal(translateString_fr);
        });
    });

    it("uses the requested locale if language code is provided in headers", function () {
      return server.inject(
        {
          method: "GET",
          url: "/localized/with/headers",
          headers: {
            "language": "fr"
          }
        })
        .then ( (response) => {
          response.result.locale.should.equal("fr");
          response.result.requestedLocale.should.equal("fr");
          response.result.message.should.equal(translateString_fr);
          return server.inject(
            {
              method: "GET",
              url: "/localized/with/headers",
              headers: {}
            })
            .then ( (response) => {
                response.result.locale.should.equal("de");
                response.result.message.should.equal(translateString_de);
              }
            );
        });
    });

    it("uses the language query parameter over the header parameter because this is more explicit", function () {
      return server.inject(
        {
          method: "GET",
          url: "/localized/with/query?lang=fr"
        })
        .then ( (response) => {
          response.result.locale.should.equal("fr");
          response.result.requestedLocale.should.equal("fr");
          response.result.message.should.equal(translateString_fr);
        });
    });

    it("should return an empty string with empty parameter", function () {
      return server.inject(
        {
          method: "GET",
          url: "/localized/with/empty",
          headers: {
            "language": "fr"
          }
        })
        .then ( (response) => {
          response.result.locale.should.equal("fr");
          response.result.message.should.equal("");
        });
    });

    it("uses the language path parameter over the header parameter because this is more explicit", function () {
      return server.inject(
        {
          method: "GET",
          url: "/fr/localized/resource",
          headers: {
            "language": "en"
          }
        })
        .then ( (response) => {
          response.result.locale.should.equal("fr");
          response.result.requestedLocale.should.equal("fr");
          response.result.message.should.equal(translateString_fr);
        });
    });

    it("translates localized strings in handlebars templates", function () {
      return server.inject(
        {
          method: "GET",
          url: "/fr/localized/view"
        })
        .then ( (response) => {
          response.statusCode.should.equal(200);
          response.result.should.equal("<!DOCTYPE html><html lang=fr><body><p>Tout est bien qui finit bien.</p></body></html>\n");
        });
    });

    it("returns status code NOT-FOUND if the requested locale is not available", function () {
      return server.inject(
        {
          method: "GET",
          url: "/en-US/localized/resource"
        })
        .then ( (response) => {
          const payload = JSON.parse(response.payload);
          payload.statusCode.should.equal(404);
          payload.message.should.equal("No localization available for en-US");
        });

    });

    it("is available in the validation failAction handler ", function () {
      return server.inject(
        {
          method: "POST",
          url: "/de/localized/validation"
        })
        .then ( (response) => {
          var payload = JSON.parse(response.payload);
          payload.statusCode.should.equal(400);
          payload.message.should.equal("Prüfung fehlgeschlagen");
        }
      );
    });



    it("must asure correct localization when processing requests concurrently", function (done) {
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
        }

        server.inject(
          {
            method: "GET",
            url: "/no/language-code/path/parameter"
          })
          .then ( (response) => {
            if (response.result.locale !== "de") {
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
            method: "GET",
            url: "/en/localized/resource"
          })
          .then ( (response) => {
            if (response.result.locale !== "en") {
              ++numErrorsWrongRequestedLocale;
            }
            if (response.result.message !== translateString_en) {
              ++numErrorsWrongTranslation;
            }
            response.result.requestedLocale.should.equal("en");
            ++numProcessedRequests;
            if (numProcessedRequests == numTotalRequests) {
              onLastResponse();
            }
          }
        );

        server.inject(
          {
            method: "GET",
            url: "/fr/localized/resource"
          })
          .then ( (response) => {
            if (response.result.locale !== "fr") {
              ++numErrorsWrongRequestedLocale;
            }
            response.result.requestedLocale.should.equal("fr");
            ++numProcessedRequests;
            if (numProcessedRequests == numTotalRequests) {
              onLastResponse();
            }
          }
        );
      }
    })

  })

})
