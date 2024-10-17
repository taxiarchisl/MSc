var contract = artifacts.require("MyElections");

module.exports = function(deployer) {
  deployer.deploy(contract);
};