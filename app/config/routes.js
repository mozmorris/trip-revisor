module.exports = function (app) {
  return {
    // home page
    '/': {'get': 'Home.index'}

    // location
  , '/location/:id/properties': {'get': 'Location.properties'}
  , '/location/create': {'get': 'Location.create'}
  , '/location/view': {'get': 'Location.view'}

    // property
  , '/property/:id': {'get': 'Property.view'}
  }
}
