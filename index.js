
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

// To connect with your mongoDB database
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, {
    dbName: 'ElmiraStories-DB',
}) 
  .then((res) => {
    console.log("Database connected");
    app.listen(5000);
  })
  .catch((error) => {
    console.log(error);
  });

//schema for memorials. This included memorial trees and benches
const MemorialSchema = new mongoose.Schema({
    memorial_ID: {
        type: String,
        required: true,
        unique: true,
    },
    dedicated_to: {
        type: String,
        required: true,
    },
    dedicated_by: {
        type: String,
        required: true,
        default: "Elmira Lions Club"
    },
    date_added: {
        type: Date,
        default: Date.now,
    },
    approximate_location: {
        type: String,   //this will be longitude and latitude
        required: true,
    },
    side_of_trail: {
        type: String,   //this will be either left or right or N/A if it's a special situation
        required: true,
    },
    additional_description: {
        type: String,   //if there is something special of note or a story associated with the tree, otherwise N/A
        
    },
    memorial_image: {
        type: String,   
        required: true,
    }

});
const Memorial = mongoose.model('memorial_trees', MemorialSchema);
//Memorial.createIndexes();

// For backend and express
const express = require('express');
const app = express();
const cors = require("cors");
console.log("App listen at port 5000");
app.use(compression()); // Compress all routes
app.use(helmet());
app.use(limiter);
app.use(express.json());
app.use('*', corse());

/*
app.use(cors({
    
    origin: "https://elmira-stories-production.up.railway.app",    //will need to set this to the domain of the web app in production
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true, //Credentials are cookies, authorization headers or TLS client certificates.
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'device-remember-token', 'Origin', 'Accept', 'Access-Control-Allow-Origin: https://elmira-stories-production.up.railway.app']
}));    
*/

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

app.post("/register_new_memorial", async (req, resp) => {
    try {
        
        const new_memorial = new Memorial({
            memorial_ID: req.body.memorialId,
            dedicated_to: req.body.dedicatedTo,
            dedicated_by: isEmpty(req.body.dedicatedBy) ? "Elmira Lions Club": req.body.dedicatedBy,
            //date added has a good default, so no real need to pass it here
            approximate_location: req.body.approximateLocation,
            side_of_trail: isEmpty(req.body.sideOfTrail) ? "N/A": req.body.sideOfTrail,
            additional_description: isEmpty(req.body.additionalDescription) ? "N/A": req.body.additionalDescription,
            memorial_image: req.body.image,
        });
        let result = await new_memorial.save();
        result = result.toObject();
        if (result) {
            resp.send(req.body);
            console.log(result);
        } else {
            console.log("Memorial already registered");
        }

    } catch (e) {
        resp.send("Something Went Wrong");
    }
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
    console.log("request recieved");
    //check if the search term is empty/null. If this is the case, return all
    //if the search term isn't empty, search with it and return results

    //this is the 'super secret' key that means the user didn't enter anything and we should return all entries
    //if someone manages to enter this in by pure chance, I will have already won the lottery six times in a row and be too rich to worry about it
    if (req.params.searchTerm !== "Dan Kuso The GOAT"){
        //search with it
        const results = await Memorial.find({
            $or: [  //search the following fields non-exclusively
                {dedicated_to: { "$regex": req.params.searchTerm, "$options": "i" }},  //this will search the field for entries that contain the search term
                {dedicated_by: { "$regex": req.params.searchTerm, "$options": "i" }},
                {additional_description: { "$regex": req.params.searchTerm, "$options": "i" }}
            ]
        }).sort()
        
        res.send(results);
    }
    else {
        //search all
        const results = await Memorial.find({})

        res.send(results);
    }
        


});






