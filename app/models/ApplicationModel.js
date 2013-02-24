module.exports = function (app, config) {
  return app.getModel('Base', true).extend(function() {

    this.mongo = require('mongodb')
    this.mongoose = require('mongoose')
    this.Schema = this.mongoose.Schema

    // only open a connection once
    if (!this.mongoose.connections[0]._readyState) {
      this.mongoose.connect('mongodb://localhost/scraper')
    }

    // nodeio job options
    this.nodeOptions = {
      timeout: 5,
      max: 15,
      retries: 3
    }
  })
}
