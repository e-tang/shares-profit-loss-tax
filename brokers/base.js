function Broker () {
    this.name = "general"
}

Broker.prototype.load = function (files, offset) {
    throw new Error("Not implemented");
}

module.exports = Broker;