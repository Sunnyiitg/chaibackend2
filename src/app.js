import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();
// configure hote hai app bnne k baad
app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials: true
})); 
// data kayi jagah se aane wali ,uske liye yesb kr rhe
// iske liye kch settings lakti hai
app.use(express.json({
    limit: "16kb"
})); // means json accept krunga

// url se data k liye configure, isme thora issue aata h
// url se jab data jata hai toh kayi jgh + ya % ya kch or hota h
app.use(express.urlencoded({
    extended : true,
    limit : "16kb"
}))
// kayi baar hum kch file folder store krna chahta hu
app.use(express.static("public")); 
// cookie-parser => server se user k browser ka cookie
//  acces and set kr pau
app.use(cookieParser());
export {app};
// multr se hum file uploading krte hai