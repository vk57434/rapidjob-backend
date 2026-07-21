const cf = require('cashfree-pg');

const Cashfree = new cf.Cashfree();

Cashfree.XClientId = process.env.CASHFREE_CLIENT_ID;
Cashfree.XClientSecret = process.env.CASHFREE_CLIENT_SECRET;
Cashfree.XEnvironment = process.env.CASHFREE_ENV === 'PRODUCTION' ? cf.CFEnvironment.PRODUCTION : cf.CFEnvironment.SANDBOX;

module.exports = Cashfree;
