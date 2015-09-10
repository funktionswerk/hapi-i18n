var Should = require( "should" );
var Hapi = require( "hapi" );
var Path = require( "path" );
var Joi = require( "joi" );
var Locale = require( "../" );

describe( "Localization", function() {
  describe( "Usage of locale in hapi", function() {
    
    var translateString_en = "All's well that ends well.";
    var translateString_de = "Ende gut, alles gut.";
    var translateString_fr = "Tout est bien qui finit bien.";
    
    var doSomething = function( cb ){
      var data = {
          rows: []
        }
      for ( i = 1; i < 100; ++i ){
        data.rows.push( i );
      }
      var fs = require( "fs" );
      var fileName = Path.join( __dirname, "database.json" );
      fs.writeFile(fileName, JSON.stringify(data), function(err) {
        Should( err ).not.exist;
        cb();
      });
    }
    
    var server = new Hapi.Server();
    server.connection( { port: 8047 } );
    server.views({
      engines: {
        jade: require( "jade" )
      },
      path: Path.join( __dirname, "views" )
    });
    
    server.route({
      method: "GET",
      path: "/no/language-code/path/parameter",
      handler: function ( request, reply ) {
        doSomething( function(){
          return reply(
              {
                locale: request.i18n.getLocale(),
                message: request.i18n.__( translateString_en )
              }
            );
        });
      }
    });
    server.route({
      method: "GET",
      path: "/{languageCode}/localized/resource",
      handler: function ( request, reply ) {
        doSomething( function(){
          return reply(
              {
                locale: request.i18n.getLocale(),
                requestedLocale: request.params.languageCode,
                message: request.i18n.__( translateString_en )
              }
            );
        });
        
      }
    });
    server.route({
      method: "GET",
      path: "/{languageCode}/localized/view",
      handler: function ( request, reply ) {
        doSomething( function(){
          return reply.view( "test" );
        });
        
      }
    });
    server.route({
      method: "POST",
      path: "/{languageCode}/localized/validation",
      handler: function(){
      },
      config: {
        validate: {
          payload: {
            param: Joi.string().required()
          },
          failAction: function (request, reply, source, error) {
            return request.i18n.__("Validation failed").code(400);
          }
        }
      }
    });

    it( "can be added as plugin", function( done ) {
      server.register(
        {
          register: Locale,
          options: {
            locales: ["de", "en", "fr"],
            directory: __dirname + "/locales"
          }
        },
        function ( err ) {
          Should.not.exist( err );
          done();
        }
      );
    });
    
    it( "extracts the default locale from the configured locales", function() {
      Should.throws( function(){ Locale.extractDefaultLocale() }, Error );
      Should.throws( function(){ Locale.extractDefaultLocale( [] ) }, Error );
      Locale.extractDefaultLocale( [ "fr", "de" ] ).should.equal( "fr" );
    });
    
    it( "uses the default locale if no language code path parameter is available", function( done ) {
      server.inject(
          {
            method: "GET",
            url: "/no/language-code/path/parameter"
          },
          function ( response ) {
            response.result.locale.should.equal( "de" );
            response.result.message.should.equal( translateString_de );
            done();
          }
        );
    });

    it( "uses the requested locale if language code is provided", function( done ) {
      server.inject(
          {
            method: "GET",
            url: "/fr/localized/resource"
          },
          function ( response ) {
            response.result.locale.should.equal( "fr" );
            response.result.requestedLocale.should.equal( "fr" );
            response.result.message.should.equal( translateString_fr );
            done();
          }
        );
    });

    it( "translates localized strings in jade templates", function( done ) {
      server.inject(
          {
            method: "GET",
            url: "/fr/localized/view"
          },
          function ( response ) {
            response.statusCode.should.equal( 200 );
            response.result.should.equal( "<!DOCTYPE html><html lang=\"fr\"><body><p>Tout est bien qui finit bien.</p></body></html>" );
            done();
          }
        );
    });

    it( "returns status code NOT-FOUND if the requested locale is not available", function( done ) {
      server.inject(
          {
            method: "GET",
            url: "/en-US/localized/resource"
          },
          function ( response ) {
            response.result.statusCode.should.equal( 404 );
            response.result.message.should.equal( "No localization available for en-US" );
            done();
          }
        );
    });

    it( "is aivailable in the validation failAction handler ", function(done){
      server.inject(
        {
          method: "POST",
          url: "/de/localized/validation"
        },
        function ( response ) {
          response.statusCode.should.equal( 400 );
          response.result.should.equal( "Prüfung fehlgeschlagen" );
          done();
        }
      );
    });
    
    it( "must asure correct localization when processing requests concurrently", function(done){
      var numIterations = 200;
      var numRequestsPerIteration = 3;
      var numProcessedRequests = 0;
      var numTotalRequests = numIterations * numRequestsPerIteration;
      var numErrorsWrongDefaultLocale = 0;
      var numErrorsWrongTranslation = 0;
      var numErrorsWrongRequestedLocale = 0;
      this.timeout( numTotalRequests * 10 );
      for ( iteration = 0; iteration < numIterations; ++iteration ){
        
        var onLastResponse = function(){
          numProcessedRequests.should.equal( numTotalRequests );
          numErrorsWrongDefaultLocale.should.equal( 0 );
          numErrorsWrongRequestedLocale.should.equal( 0 );
          done();
        }
        
        server.inject(
            {
              method: "GET",
              url: "/no/language-code/path/parameter"
            },
            function ( response ) {
              if ( response.result.locale !== "de" ){
                ++numErrorsWrongDefaultLocale;
              }
              if ( response.result.message !== translateString_de ) {
                ++numErrorsWrongTranslation;
              }
              ++numProcessedRequests;
              if ( numProcessedRequests == numTotalRequests ) {
                onLastResponse();
              }
            }
          );

        server.inject(
            {
              method: "GET",
              url: "/en/localized/resource"
            },
            function ( response ) {
              if ( response.result.locale !== "en" ){
                ++numErrorsWrongRequestedLocale;
              }
              if ( response.result.message !== translateString_en ) {
                ++numErrorsWrongTranslation;
              }
              response.result.requestedLocale.should.equal( "en" );
              ++numProcessedRequests;
              if ( numProcessedRequests == numTotalRequests ) {
                onLastResponse();
              }
            }
          );

        server.inject(
            {
              method: "GET",
              url: "/fr/localized/resource"
            },
            function ( response ) {
              if ( response.result.locale !== "fr" ){
                ++numErrorsWrongRequestedLocale;
              }
              response.result.requestedLocale.should.equal( "fr" );
              ++numProcessedRequests;
              if ( numProcessedRequests == numTotalRequests ) {
                onLastResponse();
              }
            }
          );
        
      }
    })
    
  })

})