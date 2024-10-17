var mysql = require('mysql2');
require('dotenv').config();

module.exports = {

    connect: function () {

        var con = mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        con.connect(function (err) {
            if (err) throw err;
        });

        return con;
    },


    query: async function (query, params) {

        var con = this.connect();

        try {
            var data = await con.promise().query(query, params);
        } catch (err) {
            con.end();
            return err;
        }

        //close Connection
        con.end();

        return data[0];
    }
}