function Transaction() {
    this.id = 0;
    this.date = new Date();
  
    this.type = "";
    this.description = "";
    this.category = "";

    this.symbol = undefined;
    this.company = undefined;
    this.quantity = 0;
    this.price = 0;
    this.value = 0; // trade value = quantity * price
    this.total = 0; // total value = trade value + fee 
    this.fee = 0;   // fee = commission + gst
    this.gst = 0;

    this.note = "";
}

module.exports = {
    Transaction: Transaction
}