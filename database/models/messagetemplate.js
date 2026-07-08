'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MessageTemplate extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  MessageTemplate.init({
    name: DataTypes.STRING,
    channel: DataTypes.STRING,
    subject: DataTypes.STRING,
    body: DataTypes.TEXT,
    triggerEvent: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'MessageTemplate',
  });
  return MessageTemplate;
};