
require('dotenv').config()


const {
    getSignedUrl,
} = require("@aws-sdk/s3-request-presigner");

const {
    GetObjectCommand,
    S3,
} = require("@aws-sdk/client-s3");


const helmet = require("helmet");
const compression = require("compression");
const RateLimit = require("express-rate-limit");
const limiter = RateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
});

//connect to postgres database
const pg = require('pg');
//import pg from 'pg'
const { Client } = pg
const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB,
  })
client.connect()

client.on('error', (err) => {
    console.error('something bad has happened!', err.stack)
  })


// For backend and express
const express = require('express');
const app = express();
const cors = require("cors");
console.log("App listen at port 5000");
app.use(compression()); // Compress all routes
app.use(helmet());
app.use(limiter);
app.use(express.json());

app.use(cors({
    
    origin: process.env.ALLOWED_ORIGIN,    //will need to set this to the domain of the web app in production
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true, //Credentials are cookies, authorization headers or TLS client certificates.
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'device-remember-token', 'Origin', 'Accept', 'Access-Control-Allow-Origin: '+process.env.ALLOWED_ORIGIN]    
    // for prod: allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'device-remember-token', 'Origin', 'Accept', 'Access-Control-Allow-Origin: '+process.env.ALLOWED_ORIGIN]  
}));    


function isEmpty(value){
    if (value !== "" && value !== " " && value != null && value != undefined) {
        return false;
    }
    else {
        return true;
    }
}

app.get("/", (req, resp) => {

    resp.send("App is Working");
    // You can check backend is working or not by 
    // entering http://loacalhost:5000
    
    // If you see App is working means
    // backend working properly
});




app.get('/get_memorial_image/:imageName', async (req, res) => {
    
    const s3 = new S3({
        credentials: {
            accessKeyId: process.env.ACCESS_KEY,
            secretAccessKey: process.env.SECRET_KEY,
        },
        
        region: process.env.AWS_REGION,
    });

    var params = {Bucket: process.env.BUCKET_NAME, Key: req.params.imageName};
    var promise = getSignedUrl(s3, new GetObjectCommand(params), {
        expiresIn: 3600,
    });
    promise.then(function(url) {
        
        res.send(url)
        
    }, function(err) { console.log(err) });
});


app.get('/get_memorial_by_search_term/:searchTerm', async (req, res) => {
    
    
    //check if the search term is empty/null. If this is the case, return all
    
    //this is the 'super secret' key that means the user didn't enter anything and we should return all entries
    //if someone manages to enter this in by pure chance, I will have already won the lottery six times in a row and be too rich to worry about it
    if (req.params.searchTerm !== "Dan Kuso The GOAT"){
        
        const data = ["%"+req.params.searchTerm+"%"];   //the percentages are the postgres similarity operator, so they can search for "sarah" and get "sarah fuller" as a result for instance
        const result = await client.query("SELECT * FROM MemorialTrees WHERE LOWER(dedicated_to) LIKE  LOWER($1) OR LOWER(dedicated_to) LIKE LOWER($1) OR LOWER(additional_description) LIKE LOWER($1)", data);
        
        
        res.send(result.rows);
    }
    else {
        //search all
        const result = await client.query('SELECT * FROM MemorialTrees');
        res.send(result.rows);
    }
        

    


});



app.listen(5000, "::");


