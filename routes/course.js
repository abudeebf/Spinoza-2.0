var sets = require('simplesets');
var express = require('express');
var Graph = require('data-structures').Graph;
var router = express.Router();
var fs =  require('graceful-fs')
var mongo = require('mongodb');
var monk = require('monk');// this driver to make it easy to use mongodb
var USERNAME="spinoza"
var PASSWORD="spinoza123"
//var db = monk(USERNAME+':'+PASSWORD+'@129.64.46.171:3009/spinozaDBPython');

//var db=  monk('129.64.46.171:27017/javaAssesmentDB');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;;
//var PROBLEMS =db.get('problems');
var session =require('express-session');
// localhost
var GOOGLE_APP_ID = "473808543914-j3i3vs0ip24k4es7qun99signajs152a.apps.googleusercontent.com";
var GOOGLE_APP_SECRET = 'AuVBDOKPtOlnF2_UewdNFfYf';
router.use(session({secret: 'fatimaisthebest983439439439439fdfhfhkdjhfkdh',saveUninitialized: true,resave: true}));
router.use(passport.initialize());
router.use(passport.session());
router.get('/course',function(req,res){
    res.render('course',{title:"Create new course"});   
});
