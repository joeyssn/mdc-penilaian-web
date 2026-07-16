const mariadb = require("mariadb");

async function test() {
  try {
    const conn = await mariadb.createConnection({
      host: "127.0.0.1",
      user: "root",
      password: "",
      database: "mdc_penilaian",
      port: 3306,
    });

    console.log("Connected!");

    const rows = await conn.query("SELECT USER(), CURRENT_USER()");
    console.log(rows);

    await conn.end();
  } catch (err) {
    console.error(err);
  }
}

test();