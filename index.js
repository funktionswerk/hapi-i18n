var I18n = require( "i18n" );
var Boom = require( "boom" );
var Hoek = require( "hoek" );
var _ = require( "lodash" );

exports.register = function ( server, options, next ) {
  
  var pluginOptions = {};
  if ( options )
  {
    pluginOptions = options;
  }
  I18n.configure( pluginOptions );
  
  var defaultLocale = exports.extractDefaultLocale( pluginOptions.locales );
  
  if ( !pluginOptions.locales ) {
    throw Error( "No locales defined!" );
  }
  
  server.decorate("request", "i18n", function(){
    if(!this._i18n){
        this._i18n = {};
        I18n.init( this, this._i18n );
        this._i18n.setLocale( defaultLocale );
        if ( this.params && this.params.languageCode ) {
          if ( _.includes( pluginOptions.locales, this.params.languageCode ) == false ) {
            return reply( Boom.notFound( "No localization available for " + this.params.languageCode ) );
          }
          this._i18n.setLocale( this.params.languageCode );
        }
    }
    return this._i18n;
  })
  
 
  
  server.ext( "onPreResponse", function ( request, reply ){
    if (!request.response){
      return reply.continue();
    }
    var response = request.response;
    if ( response.variety === 'view' ){
      response.source.context = Hoek.merge( response.source.context || {}, request.i18n() );
      response.source.context.languageCode = request.i18n().getLocale();
    }
    return reply.continue();
  })
  
  next();
};

exports.extractDefaultLocale = function( allLocales )
{
  if ( !allLocales ) {
    throw new Error( "No locales defined!" );
  }
  if ( allLocales.length === 0 ) {
    throw new Error( "Locales array is empty!" );
  }
  return allLocales[ 0 ];
};

exports.register.attributes = {
    pkg: require('./package.json')
};
