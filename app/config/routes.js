module.exports = function (app) {
  return {
    '/': {'get': 'Home.index'}
  , '/location/:id/properties': {'get': 'Location.properties'}
  }
}
