module.exports = function (app, config) {
  return app.getModel('Base', true).extend(function() {
    // dbClient function
    this.dbClient = function() {

      // create a redis client
      var client = app.db.createClient()

      client.on("error", function (err) {
        console.log("Error " + err)
      })

      return client
    }

    // nodeio job options
    this.nodeOptions = {
      timeout: 5,
      max: 10,
      retries: 10
    }
  })
}
