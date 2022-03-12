const https = require('http')
const xmljs = require('xml2js')
const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('bsc-control');

const createTableMeasurements = "CREATE TABLE IF NOT EXISTS MEASUREMENTS (id text, measurement real, status text, timestamp integer);";
db.run(createTableMeasurements, (err) => { if (err) console.log(err) });

const handle = 111279240;
const start = "2021-05-28T00:00:00.000+01:00";
const end = "2022-01-03T00:00:00.000+01:00";
const meteringcode = 'CH1006301234500000000000000123782';
const spec = '20013'

const openConn = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><soapenv:Envelope xmlns:belvis="Belvis.EAI" xmlns:soapenv="http://schemas.xmlsoap.org/soap/Envelope/"><soapenv:Body><belvis:OpenConnection><username>SOAP_B2C_QUAL</username><password>2021 !!C2B$$qual_SOAP</password><mandant>AUTOECO_QUAL</mandant><client>B2C</client><user>B2C</user><computer>B2C</computer></belvis:OpenConnection></soapenv:Body></soapenv:Envelope>'
const dataBody = `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bel="BelVis.EAI"><soapenv:Header/><soapenv:Body><bel:GetTimeSeriesData_Metering_NEq soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><handle xsi:type="xsd:int">${handle}</handle><iMeteringCode xsi:type="xsd:string">${meteringcode}</iMeteringCode><iSpecification xsi:type="xsd:int">${spec}</iSpecification><iEinspeisung xsi:type="xsd:int">0</iEinspeisung><iDatarangeFrom xsi:type="xsd:dateTime">${start}</iDatarangeFrom><iDatarangeTo xsi:type="xsd:dateTime">${end}</iDatarangeTo></bel:GetTimeSeriesData_Metering_NEq></soapenv:Body></soapenv:Envelope>`

const options = [{
    hostname: 'localhost',
    port: 3000,
    method: 'POST',
    path: '/BelVis.EAI.Connection8400',
    headers: {
        "content-type": "text/xml",
        "soapaction": "OpenConnection"
    }
},
{
    hostname: 'localhost',
    port: 3000,
    method: 'POST',
    path: '/BelVis.EAI.TSAccess8400',
    headers: {
        "content-type": "text/xml",
        "soapaction": "GetTimeSeriesData_Metering_NEq",
        "content-length": dataBody.length
    }
},
{
    hostname: 'localhost',
    port: 3000,
    method: 'POST',
    path: '/BelVis.EAI.Connection8400',
    headers: {
        "content-type": "text/xml",
        "soapaction": "CloseConnection"
    }

}]

let resp = '';

const req = https.request(options[1], (res) => {

    res.on('data', d => {
        resp += d.toString()
    })
    res.on('close', () => {
        xmljs.parseString(resp, (err, parsed) => {
            const measurements = [];
            if (err) {
                console.log(err)
                return;
            };

            try {
                const loadProfile = parsed['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0]['i3:TSDATA_EXT_TS'];
                loadProfile.forEach((m) => measurements.push({ timestamp: new Date(m.Zeitstempel[0]).valueOf(), measurement: Number.parseFloat(m.Value[0]), status: m.Status[0] }))
            } catch (e) {
                console.log("Failed because of: ", d.toString())
            }

            const statement = 'INSERT INTO MEASUREMENTS (id,timestamp, measurement, status) values (?,?,?,?)';


            measurements.forEach(m => db.run(statement, [meteringcode, m.timestamp, m.measurement, m.status]), (err) => { if (err) console.log(err) });

            //db.run(statement, measurements.reduce((acc, curr) => acc.concat([meteringcode, curr.timestamp, curr.measurement, curr.status]), []), (err) => { if (err) console.log(err); console.log(`Rows inserted ${this.changes}`); });
        })
    })
})

req.write(dataBody);
req.end();

/*
  edm:
    premise: http://localhost:8080/api/private
    url: http://localhost:3000
    connection: 
      path: /BelVis.EAI.Connection8400
      soap-action: OpenConnection
      body:
        username: SOAP_B2C_QUAL 
        password: 2021 !!C2B$$qual_SOAP
        mandant: AUTOECO_QUAL
        client: B2C
        user: B2C
        computer: B2C
    time-series: 
      path: /BelVis.EAI.TSAccess8400
      soap-action: GetTimeSeriesData_Metering_NEq
    close:
      path: /BelVis.EAI.Connection8400
      soap-action: CloseConnection
*/