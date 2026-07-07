'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class InvoiceLineItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  InvoiceLineItem.init({
    id: DataTypes.STRING,
    invoiceId: DataTypes.STRING,
    productId: DataTypes.STRING,
    quantity: DataTypes.INTEGER,
    unitPrice: DataTypes.DECIMAL,
    totalPrice: DataTypes.DECIMAL
  }, {
    sequelize,
    modelName: 'InvoiceLineItem',
  });
  return InvoiceLineItem;
};