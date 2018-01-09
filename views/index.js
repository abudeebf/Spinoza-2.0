
var sets = require('simplesets');
var express = require('express');
var Graph = require('data-structures').Graph;
var router = express.Router();
var fs =  require('graceful-fs')
var mongo = require('mongodb');
var monk = require('monk');// this driver to make it easy to use mongodb
var db = monk('129.64.46.171:27017/spinozaDBPython');
var ObjectID = require('mongodb').ObjectID;
//var db=  monk('129.64.46.171:27017/javaAssesmentDB');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;;
var PROBLEMS =db.get('problems');
var nodemailer = require("nodemailer");
var refreshToken1="1/xCaPAvngco9eeGeVmSnxII-dzZ2AFJUrHjXy3zR57AY"
// Gracehoppper
var GOOGLE_APP_ID = '655328920221-53pk1unv4f7q67f7usvnq69ipjfntvak.apps.googleusercontent.com';
var GOOGLE_APP_SECRET = 'zqaSSqChk8loV-bg_e7k4lSO';
var user = db.get('User');
var problemLibrary=db.get("problemLibrary");
var sharedData = db.get('Shared');
var save_problem= db.get("user_lastsave");
var user_problems=db.get("user_problems");// the last solution only
var ps_active=db.get("ps_active")
var classinfo=db.get("classInfo");
var gradeOther=db.get("gradeOther");
var debugcrowdsource=db.get("debugcrowdsource");
var user_allSolutions= db.get('userSoultionsToProblems');
var session =require('express-session');
var arr=["float","long","short","double","int","boolean","char"];
var numb=["float","boolean","long","short","double"];
var formidable = require('formidable');
var user_javaIDE=db.get("user_javaIdedb");
var coursesUsers=db.get("courses_user");
var problemset=db.get("problemset");
var location1 = __dirname.substring(0,__dirname.indexOf("routes"));
var path2 = require('path');
var hashingExec = require('sync-exec');
var re = /\S+@brandeis.edu/;

function replaceAll(find, replace, str) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function findnexthash(uUsers,useremail,hashvlues,h,k){
  while ( h<Object.keys(hashvlues).length-1 && hashvlues[h+""].hashtest!=null && uUsers[hashvlues[h+""].hashtest.trim()].size()<=k && useremail==hashvlues[h+""].useremail ){
    h=h+1;
  }
  
  
  if (hashvlues[h+""]!=undefined && uUsers[hashvlues[h+""].hashtest.trim()].size()>k  && useremail==hashvlues[h+""].useremail)
    return h;
 
  return -1*h;
}
function median(values) {

    values.sort( function(a,b) {return a - b;} );

    var half = Math.floor(values.length/2);

    if(values.length % 2)
        return values[half];
    else
        return (values[half-1] + values[half]) / 2.0;
}
function convertRGB(r,g,b) {
  var rgb= [];
  rgb = [r,g,b];
  return '#' + rgb.map(function(x){ 
    return ("0" + Math.round(x*255).toString(16)).slice(-2);
  }).join('');
};
function average(obj){
  var sum=0;
  for ( var i in obj){

    if (isNaN(obj[i])==false )
   sum +=obj[i];
  }
   
  return sum/Object.keys(obj).length;
}
function extention (mode){
  if (mode=="python")
    return "py";
  else if (mode=="javascript")
    return "js";
  else return mode;
}
function sortByValue(obj){
  var keys = [];
 
Object.keys(obj)
      .map(function (k) { return [k, obj[k]]; })
      .sort(function (a, b) {
         if (a[1] < b[1]) return -1;
         if (a[1] > b[1]) return 1;
         return 0;
      })
      .forEach(function (d) {
         keys.push(d[0]);
        
      });
 return keys;
}

router.use(session({secret: 'fatimaisthebest983439439439439fdfhfhkdjhfkdh',cookie:{maxAge:7200000},saveUninitialized: true,rolling:true,resave: true}));
router.use(passport.initialize());
router.use(passport.session());
passport.use(new GoogleStrategy({
    clientID: GOOGLE_APP_ID,
    clientSecret: GOOGLE_APP_SECRET,
    callbackURL: '/auth/google/callback'
}, function(token, refreshToken, profile, done) {
    var email=profile._json.email;
    var name=profile._json.name;
    // make the code asynchronous
    // User.findOne won't fire until we have all our data back from Google
    process.nextTick(function() {
        user.find({"email":email},function(err,docs){
            if (err)
                return done(err);
            if (docs.length==0){
                user.insert({
                    "email" : email,
                    "name"  :name,
                    "role"  :"student"
                }, function (err, doc) {
                    if (err) {
                        // If it failed, return error
                        console.log(err);
                    }
                    
                    // If it worked, set the header so the address bar doesn't still say /adduser
                       
                });}
            else if (docs.name== null || docs.name==undefined){ // in case I add a TA who did not register first
              user.update({"email":email} ,{$set:{"name":name}} ,{upsert:true});  
            }

            done(null, profile);

        });
    });}));

// determine what data should be stored in the session
passport.serializeUser(function(user, done) {
   
    done(null, user);
});
// this is happen for every request
passport.deserializeUser(function(obj, done) {
   
    user.findOne({"email":obj._json.email}, function(err, user) {
       
        done(err, user);
    });
});

/* GET home page. */
 router.get('/', function(req, res) {

    res.render('login');
 });
router.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));
router.get('/auth/google/callback',function(req, res, next){
    passport.authenticate('google', function(err, user, info){
    // This is the default destination upon successful login.
    
 var redirectUrl = '/profile';
    
    if (err) { return next(err); }
    if (!user) { return res.redirect('/'); }

    // If we have previously stored a redirectUrl, use that, 
    // otherwise, use the default.
    if (req.session.redirectUrl) {
      redirectUrl = req.session.redirectUrl;
      req.session.redirectUrl = null;
    }
    req.logIn(user, function(err){
      if (err) { return next(err); }
    });
    res.redirect(redirectUrl);
  })(req, res, next);
});
router.get('/pythonide',isLoggedIn,function(req,res){
   user.findOne({email:req.user.email},function(e,user2){
    res.render('pythonide.jade'); 
    });
  });
router.post("/activate",isLoggedIn, function(req, res) {
  ps_active.update({"email":req.user.email,"psid":req.body.psid},{$set:{ "pin":req.body.pin}},{upsert:true});
  res.send("success");
});

router.post("/unactive",isLoggedIn, function(req, res) {
  ps_active.update({"email":req.user.email,"psid":req.body.psid},{$set:{ "pin":"","active":false}},{upsert:true});
  res.send("success");
});
router.post('/problems/delete', isLoggedIn, function(req, res) {
    var id =req.body.id1;
    PROBLEMS.remove({_id:PROBLEMS.id(id)}, function (err, doc) {
        if (err) {
            // If it failed, return error
            res.send("There was a problem removing the information to the database.");
        }
        else {
            // If it worked, set the header so the address bar doesn't still say /addproblem
            // And forward to success page
            res.send("infromation inserted");
        }
 });
});


router.post("/showothercode",isLoggedIn,function(req,res){
  gradeOther.update({"useremail":req.user.email,"pid":req.body.pid},{$set:{"allowgrading":req.body.othercode,"classId":req.body.classId,"psid":req.body.psid}},{upsert:true});
  res.send("success");
});
router.get("/codeshared",isLoggedIn,function(req,res){
 var usersNames={};
 var pidNames={};
  user.find({},function(e,users){
    for( u in users){
      usersNames[users[u].email]=users[u].name;
    }
  PROBLEMS.find({},function(e,assignments){
    console.log(assignments);
    for (ass in assignments){
      pidNames[assignments[ass]._id]=assignments[ass].pname;

    }
   sharedData.find({"sharedWith":req.user.email},{sort:{sharedCodeEmail:1,time:1}} ,function(e,sharedCode){
   res.render('sharedCode',{user:req.user,sharedCode:sharedCode,usersNames:usersNames,pidNames:pidNames}); 
  });
});
  });
});



router.get('/getattendance/:classId', isLoggedIn,isAdmin, function(req, res) {
  problemset.find({classId:req.params.classId},{},function(e,ps){
      var ps2=[];
      for (var p in ps)
       ps2.push({id:ps[p]._id, label:ps[p].pname,isChecked: false});
    res.render("attend",{user:req.user,classId:req.params.classId,ps:ps2});
  });
  

  
});
router.get('/getattendance/:classId/:range/:id2', isLoggedIn,isAdmin, function(req, res) {
  var range2=req.params.range.split(";");
  var d1= new Date(replaceAll(":","/",range2[0]).replace("*",":").replace("_"," "));
  var d2= new Date(replaceAll(":","/",range2[1]).replace("*",":").replace("_"," "));
  var problsetsid=req.params.id2.split(",");
  
  d1=new Date(d1.toISOString());
  d2=new Date(d2.toISOString());
  var users={};
  var classUsers=[];
  var  user_range_Pid={};
  var user_runNo={};
  var user_percentage={};
  var user_time={};
  var classId=req.params.classId;
  var pids=[]
  var debug_users={};
  var debugId_users={};
  problemset.find({classId:req.params.classId},{},function(e,ps){
      var ps2=[];
      for (var p in ps)
        if (problsetsid.indexOf(ps[p]._id.toString())>-1)
          ps2.push({id:ps[p]._id, label:ps[p].pname,isChecked: true});
        else
           ps2.push({id:ps[p]._id, label:ps[p].pname,isChecked: false});
  PROBLEMS.find({problemsetId:{$in:problsetsid}},function(e,problems){
    for (var p in problems)
      pids.push(problems[p]._id.toString());
    
    classinfo.findById(classId,{},function(e,class1){
    coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1}},function(e,students){
     for (var u in students){
       if (students[u].role !="adminteacher")
         classUsers.push(students[u].useremail);
     }
     user.find({email:{$in:classUsers}},function(e,users2){
       for (var us in users2){
        users[users2[us].email]=users2[us].name;
       }
     
     var useremails=Object.keys(users);
     //if they started the problem in the given time.
     user_allSolutions.col.aggregate({"$match":{ "useremail" : { $in:classUsers},"pid":{$in:pids}}},{$group:{_id:{useremail:"$useremail",pidNo:"$pid"},time1:{$addToSet:"$time"}}},{$sort:{time1:1}}, function(e,timeproblems){
    for ( var record in timeproblems){
        var diff=timeproblems[record].time1;

         diff.sort(function(a,b){return a.getTime() - b.getTime()});
         //check if he begin any problems in range of time
       if ( new Date(diff[0]).getTime()>= d1.getTime() && new Date(diff[0]).getTime()<=d2.getTime()){
        
         if (timeproblems[record]._id.useremail in  user_range_Pid==false)
          user_range_Pid[timeproblems[record]._id.useremail]=[];
          user_range_Pid[timeproblems[record]._id.useremail].push(timeproblems[record]._id.pidNo);
      }
    }

    debugcrowdsource.find({"useremail" : { $in:classUsers},"pid":{$in:pids}},{$sort:{time1:1}}, function(e,debugcomments){
      for(var d in debugcomments){
        if (debugcomments[d].useremail in debug_users==false)

          debug_users[debugcomments[d].useremail]=0;
        if (debugcomments[d].useremail in debugId_users==false)
          debugId_users[debugcomments[d].useremail]=new sets.Set();
        var debugdate=dateFromObjectId(debugcomments[d]._id.toString())
         if ( debugdate.getTime()>= d1.getTime() &&  debugdate<=d2.getTime()){
          debug_users[debugcomments[d].useremail]+=1;
          debugId_users[debugcomments[d].useremail].add(debugcomments[d].pid);
        }
      }
    user_allSolutions.col.aggregate({"$match":{ "useremail" : { $in:classUsers},"percentcorrect":100,"pid":{$in:pids}}},{$group:{_id:{useremail:"$useremail",pidNo:"$pid"},time1:{$addToSet:"$time"}}},{$sort:{time1:1}}, function(e,correctsolution3){
    for ( var fs in correctsolution3){
             if (correctsolution3[fs]._id.useremail in user_percentage==false)
                 user_percentage[correctsolution3[fs]._id.useremail]=0;
              var timeToSubmit2=correctsolution3[fs].time1;
             
              var g=false;
              for (var t in timeToSubmit2){

                var timeToSubmit=new Date(timeToSubmit2[t]);
                
                if(timeToSubmit.getTime()>= d1.getTime() && timeToSubmit.getTime()<=d2.getTime()){
                 
                  g=true}
                 }
                if(g){
                user_percentage[correctsolution3[fs]._id.useremail]= user_percentage[correctsolution3[fs]._id.useremail]+1;
                
              }}
  
   user_allSolutions.col.aggregate({"$match":{ "useremail" : { $in:useremails},"time": {$gte: d1 ,$lte: d2 },"pid":{$in:pids}}},{$group:{_id:{useremail:"$useremail",pid:"$pid"}, count:{$sum:1}}}, function(e,allProblems){
            for (var i in allProblems){
                if(allProblems[i]._id.useremail in user_runNo)
                  user_runNo[allProblems[i]._id.useremail]=user_runNo[allProblems[i]._id.useremail]+allProblems[i].count;
                else
                 user_runNo[allProblems[i]._id.useremail]=allProblems[i].count; // number of run
             }
           
  
  res.render("attend",{debugId_users:debugId_users,debug_users:debug_users,user_percentage:user_percentage,user:req.user,d1:d1,d2:d2,useremails:useremails,users:users,user_range_Pid:user_range_Pid, user_runNo: user_runNo,user_percentage:user_percentage,classId:classId,ps:ps2});
  });
    });
   });
 });
  });
 });
  });
});
});
router.get('/problems/submission/:id/:useremail',isLoggedIn,function(req,res){
    var dirName=req.params.id;
    var dirPath="users/"+req.user.email+"/"+dirName;
    user.findOne({email:req.params.useremail},function(error,student1){
      PROBLEMS.findById((req.params.id),{},function(e,problem){
          
          var user_submission=db.get('user_problems');
          var prototype=problem.prtotype;
          var studentname="";
          var date="";
          var save_problem= db.get("user_lastsave");
          save_problem.findOne({"useremail":req.params.useremail,"pid": dirName} ,function (err2, doc2) {
           if(err2==null)
               {
                if(doc2!==null){
                   
                    prototype=doc2.solution;
                    studentname=student1.name;
                    date="did not submit";
              }
            }
          user_submission.findOne({"useremail":req.params.useremail,"pid": dirName}      
      ,function (err, doc) {
          
               if(err==null)
               {
                if(doc!==null & doc.submit==true){
                    prototype=doc.code;
                    studentname=student1.name;
                    date=doc.submissiontime;
              }
            }   
          
               user.findOne({email:req.user.email},function(e,user2){
              res.render('viewsubmission', {
                  title : problem.Description,result:"program result",code:prototype,test:"",id1: dirName,grader:req.user,student:req.params.useremail,studentname:studentname,date:date,classname:problem.classname,theme:user2.theme});
         });
     
  });
  });
  });
});
});
});
router.get('/students/:classId/:email',isLoggedIn,isAdmin,function(req,res){
     var problemsdict = {};
     var problemsetdict={}
     user.findOne({email:req.params.email},function(e,user2){
      
       PROBLEMS.find({},{sort: { _id: -1}},function (e,problems){
        problemset.find({},{sort: { _id: -1}},function(e,problemsets){
           for(p in problemsets){
            problemsetdict[problemsets[p]._id]=problemsets[p].pname;
           }
           for ( i in problems){
            problemsdict[problems[i]._id]=problemsetdict[problems[i].problemsetId]+"::"+problems[i].pname;
           }
          
          user_problems.find({useremail:req.params.email},{sort: { time: -1}},function(e,problems2){
            res.render("studentsubmission",{user:req.user,problems:problems2,problemsdict:problemsdict,user2:user2});
       });
     });
        });
     });
     
});
router.post('/copybuggyproblem', function(req, res) {
   var id =req.body.id1;
   var code=req.body.code1;
    PROBLEMS.findById((id),{},function(err,p){
        if (err) {
            // If it failed, return error
            res.send("There was a problem finding this id in problems collection");
        }
        else {
           PROBLEMS.insert({
              "Description" : p.Description,
              "pname" :"Buggy version of " +p.pname,
              "classId":p.classId,
              "problemsetId":p.problemsetId,
              "creator":req.user.email,
              "test_generator":p.test_generator,
              "sol":p.sol,
              "scafolding":code,
              "retype":p.retype,
              "show":true,
              "pNumbers":p.pNumbers,
              "methodname":p.methodname
          }, function (err, doc) {
              if (err) {
                  // If it failed, return error
                  res.send("There was a problem adding the information to the database.");
              }
              else {
                  // If it worked, set the header so the address bar doesn't still say /addproblem
                   res.send("infromation inserted");
              }
           
        });
 }
});
});
router.post('/problems/copy', isLoggedIn, function(req, res) {
    var id =req.body.id1;
    PROBLEMS.findById((id),{},function(err,p){
        if (err) {
            // If it failed, return error
            res.send("error");
        }
        else {
           PROBLEMS.insert({
          "Description" : p.Description,
          "pname" : "copy of " +p.pname,
          "classId":p.classId,
          "problemsetId":p.problemsetId,
          "creator":req.user.email,
          "test_generator":p.test_generator,
          "sol":p.sol,
          "scafolding":p.scafolding,
          "retype":p.retype,
          "show":false,
          "pNumbers":p.pNumbers,
          "methodname":p.methodname
          }, function (err, doc) {
              if (err) {
                  // If it failed, return error
                  res.send("There was a problem adding the information to the database.");
              }
              else {
                  // If it worked, set the header so the address bar doesn't still say /addproblem
                   res.send("infromation inserted");
              }
           
        });
 }
});
});
router.get('/classes/problems/:id1', isLoggedIn, function(req, res) {
    var classId=req.params.id1;
    var pcompleted=[];
    var pIds=[];
    if((req.params.id1=="587e2642b9163bcd44dae90b")==true &&  re.test(req.user.email)==false){
      res.render("login",{message:"Error you have to login with brandeis unit id"});
    }
    else{
      user_problems.find({"useremail":req.user.email,"classId":classId},{},function(e,docs2){
        for (var i in docs2)
          {
            if(docs2[i].compelete==true)
              pcompleted.push(docs2[i].pid);
            
          }
          var unactive=[]
          ps_active.find({"email":req.user.email,"active":false},function(e,unactivepsid){
            for(var una in unactivepsid)
              unactive.push(unactivepsid[una].psid);
          console.log(unactive)
          PROBLEMS.find({"classId":classId},{sort: { _id: -1}},function(e,problems1){
            for (var p in problems1)
              pIds.push(problems1[p]._id.toString())
          problemset.find({"classId":classId},{sort: { _id: -1}},function(e,docs){

              classinfo.findById((classId),{},function(e,classinfom){
                coursesUsers.findOne({"useremail":req.user.email,"codePin":classinfom.classPin},function(e,userinfo){
                var classtimecount=0;
                var problemscount=0
                var classtimecorrect=0;
                var problemcorrectcount=0;
                user_allSolutions.col.aggregate({"$match":{ "useremail" : req.user.email,"pid":{ $in:pIds}}},{$group:{_id:{useremail:"$useremail",pidNo:"$pid"},time1:{$addToSet:"$time"}}},{$sort:{time1:1}}, function(e,timeproblems){
                    for ( var record in timeproblems){
                      var diff=timeproblems[record].time1;
                        var flag=false;
                        for (t in diff){
                          if((diff[t].getDay()==1 || diff[t].getDay()==3 || diff[t].getDay()==4) &&( diff[t].getHours()>=10 && diff[t].getHours()<=11 ))
                           flag=true
                        }
                        if(flag)
                          classtimecount+=1;
                    }
                    problemscount=timeproblems.length;
                var total_debug=0;
                var total_debugedproblems=0;
                debugcrowdsource.col.aggregate({"$match":{ "useremail" : req.user.email,"pid":{ $in:pIds}}},{$group:{_id:{useremail:"$useremail",pidNo:"$pid"},ids:{$addToSet:"$_id"}}},{$sort:{time1:1}}, function(e,debugsolutions){
                   for (var d in debugsolutions){
                    total_debugedproblems+=1;
                    total_debug+=debugsolutions[d].ids.length;


                   }
                 

                user_allSolutions.col.aggregate({"$match":{ "useremail" : req.user.email,"percentcorrect":100,"pid":{ $in:pIds}}},{$group:{_id:{useremail:"$useremail",pidNo:"$pid"},time1:{$addToSet:"$time"}}},{$sort:{time1:1}}, function(e,solutions){
                  for ( var record in solutions){
                      var diff=solutions[record].time1;
                        var flag=false;
                        for (t in diff){
                          if((diff[t].getDay()==1 || diff[t].getDay()==3 || diff[t].getDay()==4) &&( diff[t].getHours()>=10 && diff[t].getHours()<=11 ))
                           flag=true
                        }
                        if(flag)
                          classtimecorrect+=1;
                    } 
                    problemcorrectcount=solutions.length
            res.render('problemset', {
              "problemsetlist" : docs,unactive:unactive ,total_debug:total_debug,total_debugedproblems:total_debugedproblems,userinfo:userinfo,user:req.user,problemcompleted:pcompleted,classId:classId,classinfom:classinfom,classtimecorrect:classtimecorrect,problemscount:problemscount,classtimecount:classtimecount,problemcorrectcount:problemcorrectcount
            });
            });
             });
          });
          });
          });
          });
         });
});
      });
    }

});
router.get("/library/:classId",isLoggedIn,isAdmin,function(req,res){
   problemLibrary.find({},function(e,problems){
    res.render("library",{user:req.user,problems:problems});
   });
});

router.get("/doLibrary",isLoggedIn,function(req,res){
  PROBLEMS.find({},function(e,problems){
    for (p in problems){
      problemLibrary.update({"Description":problems[p].Description,"pname":problems[p].pname},{$set:{ "test_generator":problems[p].test_generator,"sol":problems[p].sol,"scafolding":problems[p].scafolding,"retype":problems[p].retype,"pNumbers":problems[p].pNumbers,"methodname":problems[p].methodname,"showcases":problems[p].showcases}},{upsert:true});
       }
       console.log("Library");
       res.render("login");

  });
  });
// add all solutions to problem
router.post('/addsoultiontoproblem',isLoggedIn,function(req,res){
   var percentage=req.body.percentage
   var passed=false;
   var hashtest;
   if(Number(percentage)==100)
    passed=true
  console.log("percentage")
  console.log(percentage)
  if(req.body.compliererror=="true"){
   
    var error=req.body.stdout.split(/\r?\n/);
    var test1=error.slice(2,error.length-2).join("").trim().replace(/ /g,'');
    var command2="printf '%s' \""+ String(test1)+"\" | md5sum";
     hashtest=hashingExec(command2,{async:false}).stdout.trim();
   
     user_allSolutions.update({
        "pid" : req.body.pid,
        "useremail" : req.user.email,"time":new Date()},{$set:{"hashtest":hashtest,"solution":req.body.sol,"compliererror":req.body.compliererror,"testpassed":passed,"stderr":String(test1),"stdout":req.body.stdout,"percentcorrect": Number(percentage)}},{upsert:true});
     //update last solution for grouping
     user_problems.update({"pid" : req.body.pid,
        "useremail" : req.user.email,
        },{$set:{"hashtest":hashtest,"solution":req.body.sol,"compliererror":req.body.compliererror,"testpassed":passed,"stderr":String(test1),"time":new Date(),"stdout":req.body.stdout,"percentcorrect": Number(percentage),username:req.user.name}},{upsert:true});

   }
  else{
    console.log("result");
    console.log(req.body.result)
   var command2="printf '%s' "+ req.body.result+" | md5sum";
   hashtest=hashingExec(command2,{async:false}).stdout.trim();
   console.log("hashtest");
    console.log(hashtest)
   user_allSolutions.update({
        "pid" : req.body.pid,
        "useremail" : req.user.email,"time":new Date()},{$set:{"hashtest":hashtest,"solution":req.body.sol,"compliererror":req.body.compliererror,"testpassed":passed,"stderr":req.body.stderr,"stdout":req.body.stdout,"percentcorrect": Number(percentage)}},{upsert:true});
        //update last solution for grouping
        user_problems.update({
        "pid" : req.body.pid,
        "useremail" : req.user.email},{$set:{"hashtest":hashtest,"solution":req.body.sol,"time":new Date(),"compliererror":req.body.compliererror,"testpassed":passed,"stderr":req.body.stderr,"stdout":req.body.stdout,"percentcorrect": Number(percentage),username:req.user.name}},{upsert:true}); }
       debugcrowdsource.find({"pid":req.body.pid,"hashtest":hashtest,bugtype:{$in:["Syntaxerror","logicerror"]}},function(e,hints){
        var syntax=[]
        var logic=[]
        for ( s in hints){
          if(hints[s].bugtype=="Syntaxerror")
            syntax.push(hints[s].comment)
          else
            logic.push(hints[s].comment)
        }
        res.send({syntax:syntax,logic:logic}) ; 
    });
  });

router.get("/deletextra/:problemId",isLoggedIn,function(req,res){

 
  user_problems.find({"pid":req.params.problemId},{sort:{time:1}},function(e,doc){
    var users_ids={};
  for (var e in doc){
    if (doc[e].useremail in users_ids==false)
      users_ids[doc[e].useremail]=[];
      users_ids[doc[e].useremail].push(doc[e]._id);
  }
  for (var u in users_ids){
    if(users_ids[u].length>1){
      console.log(users_ids[u].length)
      users_ids[u].pop();
      console.log(users_ids[u].length)
      user_problems.remove({_id:{$in:users_ids[u]}});
    }

  }
 

  // for (p in timeproblems){
  //   console.log(timeproblems[p].Ids)
  //   if (timeproblems[p].Ids>1){
  //     console.log(timeproblems[p].Ids)
  //    var x=timeproblems[p].Ids.pop();
  //    console.log(x)
  //    for ( i in x){
  //    user_problems.remove({_id:user_problems.id(x[i])});
  //    }
  //   }
  // }
  res.render("error");

});
});
router.get('/newproblem/:classId/:problemsetId',isLoggedIn,isAdmin,function(req,res){
    
     
    var classId=req.params.classId;
    var problemsetId=req.params.problemsetId;
    var defualtTest="def unitTest(seed):\n\tr=Random(seed)\n\twholeTest=[]\n\tfor i in range(0,10):\n\t\twholeTest.append([r.randInt(1,100),r.randBol(),r.randDouble()])\n\treturn wholeTest;"
    classinfo.findById(ObjectID(classId),{},function(e,classinfom){
      coursesUsers.findOne({"useremail":req.user.email,"codePin":classinfom.classPin},function(e,userinfo){
    res.render('newproblem',{title:'Create new problem to solve ',classId:classId,problemsetId:problemsetId,classinfom:classinfom,userinfo:userinfo,user:req.user,defualtTest:defualtTest});    });
    });
      
   
});
  var dateFromObjectId = function (objectId) {
  return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
  };
var ID = function () {
  // Math.random should be unique because of its seeding algorithm.
  // Convert it to base 36 (numbers + letters), and grab the first 9 characters
  // after the decimal.
  return '_' + Math.random().toString(36).substr(2, 8);
};
router.post('/addnewClass',isLoggedIn, function(req, res) {
    var cname= req.body.cname;
    var pin=ID()+"";
    classinfo.insert({
        "cname" : cname,
        "classPin":pin,
        "cSemester":req.body.cSemester,
        "ccode":req.body.ccode
        
    }, function (err, doc) {
        if (err) 
            // If it failed, return error
            res.send("There was a problem adding the information to the database.");
        else
        {
          coursesUsers.update({"codePin" :pin ,"useremail" : req.user.email},{"role":"adminteacher","codePin" :pin ,"useremail" : req.user.email},{upsert:true});  
          res.location("profile");
          // And forward to success page
          res.redirect("profile");
        }
        
      });
  });

router.get('/joincreateclass',isLoggedIn,function(req,res){
    res.render('newclass',{title:"Create new class ",user:req.user,section:""});   
});
router.post("/joinClass",isLoggedIn,function (req,res,next){
  classinfo.find({"codePin" : req.body.cpin.trim()},function(e,class1){
  coursesUsers.update({
        "classId":class1._id,
        "codePin" : req.body.cpin.trim(),
        "useremail" : req.user.email},{"codePin" : req.body.cpin.trim(),
        "useremail" : req.user.email,"role":"student" },{upsert:true});
   res.location("profile");
   // And forward to success page
   res.redirect("profile"); 
   }); 
});

router.get('/logout', function(req, res) {
    req.logout();
    res.render('login');
});
router.post("/sendemail",isLoggedIn,function(req,res){
  var smtpTransport = nodemailer.createTransport("SMTP", {
    service: "Gmail",
    auth: {
      XOAuth2: {
        user: "abudeebf@brandeis.ed", // Your gmail address.                                      // Not @developer.gserviceaccount.com
        clientId: GOOGLE_APP_ID,
        clientSecret: GOOGLE_APP_SECRET,
        refreshToken: refreshToken1
      }
    }
  });

var mailOptions = {
  from: "abudeebf@brandeis.edu",
  bcc: req.body.selectedStudents,
  subject:req.body.selectedsubject,
  cc:"tjhickey@brandeis.edu",
  generateTextFromHTML: true,
  text: req.body.selectedMessage
};

smtpTransport.sendMail(mailOptions, function(error, response) {
  if (error) {
    console.log(error);
  } else {
    console.log(response);
  }
  smtpTransport.close();
  res.redirect(req.get('referer'));
});

});
router.post("/sendabsentemail",isLoggedIn,function(req,res){
  var smtpTransport = nodemailer.createTransport("SMTP", {
    service: "Gmail",
    auth: {
      XOAuth2: {
        user:"abudeebf@brandeis.edu" , // Your gmail address.
                                              // Not @developer.gserviceaccount.com
        clientId: GOOGLE_APP_ID,
        clientSecret: GOOGLE_APP_SECRET,
        refreshToken: refreshToken1
      }
    }
  });

var mailOptions = {
  from: "abudeebf@brandeis.edu",
  bcc: req.body.absentvalue,
  subject:req.body.Absentsubject,
  cc:"tjhickey@brandeis.edu",
  generateTextFromHTML: true,
  text: req.body.AbsentMessage
};

smtpTransport.sendMail(mailOptions, function(error, response) {
  if (error) {
    console.log(error);
  } else {
    console.log(response);
  }
  smtpTransport.close();
  res.redirect(req.get('referer'));
});

});

router.get('/students/:classId',isLoggedIn,isAdmin,function(req,res){
    var classId=req.params.classId;
    var classUsers=[];
    var users={};
    classinfo.findById(classId,{},function(e,class1){
      coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1}},function(e,students){
      for (var u in students){
        if (students[u].role !="adminteacher")
          classUsers.push(students[u].useremail);
        }
      user.find({email:{$in:classUsers}},function(e,users2){
          for (var us in users2){
          users[users2[us].email]=users2[us].name;
        }
        res.render("students",{user:req.user,users:users,classId:req.params.classId});
        });
    });
  });
});
router.get('/profile', function(req, res) {

    var classesPin=[];
    coursesUsers.find({"useremail":req.user.email},function(e,coursespin){
      
        for( c in coursespin)
          classesPin.push(coursespin[c].codePin)
        classinfo.find({"classPin":{$in: classesPin}},function(e,classesinfo){
          
         res.render('profile',{user:req.user,classesinfo:classesinfo});
        });
       
    });
 });

router.get('/viewstudentstat/:classId/:sort/:range', isLoggedIn,isAdmin,function(req,res){
  var userCompNo={};
  var users={};
  var sort=req.params.sort;
  var range=req.params.range;
  var classId=req.params.classId;
  if (range!="AllRecords"){
    var range2=req.params.range.split(";");
    var d1= new Date(replaceAll(":","/",range2[0]).replace("*",":").replace("_"," "));
    var d2= new Date(replaceAll(":","/",range2[1]).replace("*",":").replace("_"," "));
}
  var user_runNo={};
  var user_problemNo={};
  var user_pid={};
  var user_avgproblemrun={};
  var avgProblemNo=0;
  var avgproblemrun=0
  var avgavgproblemrun=0;
  var avghproblems=0;
  var user_medianTime={};
  var user_range_Pid={};
  var avg_avg_time=0;
  var sorter=[];
  var user_percentage={};
  var classUsers=[];
  var user_debugtotal=[];
  classinfo.findById(classId,{},function(e,class1){
    var classname=class1.cname + " "+ class1.cSemester+ " / "+ class1.ccode;
  coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1}},function(e,students){
   for (var u in students){
     if (students[u].role !="adminteacher")
       classUsers.push(students[u].useremail);
   }
   console.log(classUsers);
   user.find({email:{$in:classUsers}},function(e,users2){
     for (var us in users2){
      users[users2[us].email]=users2[us].name;
     }
   
   var useremails=Object.keys(users);
   // here to seprate the class problems and homework problems
    var users_inclasstime={}
    // get the time each problems took to solved.
    debugcrowdsource.col.aggregate({"$match":{ "useremail" : { $in:useremails}}},{$group:{_id:{useremail:"$useremail"},ids:{$addToSet:"$_id"}}},{$sort:{time1:1}}, function(e,debugproblems){
      for (var d in debugproblems)
        user_debugtotal[debugproblems[d]._id.useremail]=debugproblems[d].ids.length;
    user_allSolutions.col.aggregate({"$match":{ "useremail" : { $in:useremails}}},{$group:{_id:{useremail:"$useremail",pidNo:"$pid"},time1:{$addToSet:"$time"}}},{$sort:{time1:1}}, function(e,timeproblems){
      for ( var record in timeproblems){
        if (timeproblems[record]._id.useremail in user_pid==false)
         user_pid[timeproblems[record]._id.useremail]=[];
         var diff=timeproblems[record].time1;

         diff.sort(function(a,b){return a.getTime() - b.getTime()});
         var diffInMinutes=(((diff[diff.length-1]-diff[0])/1000)/60);
         if (range=="AllRecords" || (range!="AllRecords" &&  new Date(diff[0]).getTime()>= d1.getTime() && new Date(diff[diff.length-1]).getTime()<=d2.getTime())){
          user_pid[timeproblems[record]._id.useremail].push(diffInMinutes);
          
           if (timeproblems[record]._id.useremail in  user_range_Pid==false)
            user_range_Pid[timeproblems[record]._id.useremail]=[];
            if(range!="AllRecords"){
            user_range_Pid[timeproblems[record]._id.useremail].push(timeproblems[record]._id.pidNo);
        }
        // find a way to get the day from the instrucotr now it is hard coded in the program not good =()
          if ( timeproblems[record]._id.useremail in users_inclasstime==false)
            users_inclasstime[timeproblems[record]._id.useremail]=0
          var flag=false;
          for (t in diff){
            if((diff[t].getDay()==1 || diff[t].getDay()==3 || diff[t].getDay()==4) &&( diff[t].getHours()>=10 && diff[t].getHours()<=11 ))
             flag=true
          }
          if(flag)
             users_inclasstime[timeproblems[record]._id.useremail]+=1;
      }
      }

      for ( var user1 in user_pid){
        
        user_medianTime[user1]=median(user_pid[user1]);;
       
      }
     
     
     
        user_problems.find({useremail:{ $in:useremails}},{sort:{useremail:1}},function(e,finalsolutions){
        for ( var fs in finalsolutions){
             if (finalsolutions[fs].useremail in user_percentage==false)
                 user_percentage[finalsolutions[fs].useremail]=0;
            if(  finalsolutions[fs].percentcorrect==100 ){
              var timeToSubmit=new Date(finalsolutions[fs].time);
              if((range!="AllRecords"&& timeToSubmit.getTime()>= d1.getTime() && timeToSubmit.getTime()<=d2.getTime())|| range=="AllRecords")
                user_percentage[finalsolutions[fs].useremail]=user_percentage[finalsolutions[fs].useremail]+1;}
         }
        
        user_allSolutions.col.aggregate({"$match":{ "useremail" : { $in:useremails}}},{$group:{_id:"$useremail", count:{$sum:1},pidNo:{$addToSet:"$pid"}}}, function(e,allProblems){
           for (var i in allProblems){
             if(range=="AllRecords"){
             user_runNo[allProblems[i]._id]=allProblems[i].count;
             user_problemNo[allProblems[i]._id]=allProblems[i].pidNo.length;
             user_avgproblemrun[allProblems[i]._id]=user_runNo[allProblems[i]._id]/ user_problemNo[allProblems[i]._id];
           }}
            user_allSolutions.col.aggregate({"$match":{ "useremail" : { $in:useremails}}},{$group:{_id:{useremail:"$useremail",pid:"$pid"}, count:{$sum:1}}}, function(e,allProblems){
            for (var i in allProblems){
             if(range!="AllRecords"){
                if(allProblems[i]._id.useremail in user_runNo)
                  user_runNo[allProblems[i]._id.useremail]=user_runNo[allProblems[i]._id.useremail]+allProblems[i].count;
                else
                 user_runNo[allProblems[i]._id.useremail]=allProblems[i].count; // number of run
             
           }}
            if(range!=="AllRecords"){
                for (var keyUser in user_runNo){
                  if(keyUser in user_range_Pid){
                    user_problemNo[keyUser]=user_range_Pid[keyUser].length;
                    user_avgproblemrun[keyUser]=user_runNo[keyUser]/ user_problemNo[keyUser];
              }
              else{
                 user_problemNo[keyUser]=0;
                user_avgproblemrun[keyUser]=user_runNo[keyUser]/ user_problemNo[keyUser];
              }
           }
         }
           if(sort=="runPerProblems")
            sorter=sortByValue(user_runNo);
           else if(sort=="name")
            sorter=sortByValue(users);
           else if (sort=="email")
            sorter=Object.keys(users);
          else if (sort=="noProblem")
            sorter=sortByValue(user_problemNo);
          else if (sort=="avgRunPerProblems")
             sorter=sortByValue(user_avgproblemrun);
          else if(sort=="medianTime")
            sorter=sortByValue(user_medianTime);
          else if (sort="percentcorrect")
            sorter=sortByValue(user_percentage);
          else if(sort="inclasstime")
            sorter=sortByValue(users_inclasstime);
          else
             sorter=Object.keys(users);
           avgProblemNo=average(user_problemNo);
           avgproblemrun=average(user_runNo);
           avgavgproblemrun=average(user_avgproblemrun);
           avg_avg_time=average(user_medianTime);
           var average_inclasstime=average(users_inclasstime);
           var average_correct=average(user_percentage);
           
           res.render("studentstat",{user_debugtotal:user_debugtotal,average_inclasstime:average_inclasstime,classId:classId,classname:classname,sort:sort,user:req.user,sorter:sorter,users:users,user_runNo:user_runNo, user_problemNo:user_problemNo,avgProblemNo:avgProblemNo,avgproblemrun:avgproblemrun,user_medianTime:user_medianTime,avg_avg_time:avg_avg_time,user_avgproblemrun:user_avgproblemrun,avgavgproblemrun:avgavgproblemrun,range:range,d1:d1,d2:d2, user_percentage: user_percentage,average_correct:average_correct,users_inclasstime:users_inclasstime});
        });
      });
    });
  });
 });
});
});
});
});
router.get('/enrolstudents/:classId',isLoggedIn,isAdmin, function(req, res) {
  var classId=req.params.classId;
  var classUsers=[];
  var users={};
  classinfo.findById(classId,{},function(e,class1){
    var classname=class1.cname + " "+ class1.cSemester+ " / "+ class1.ccode;
    coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1}},function(e,students){
      for (var u in students){
        if (students[u].role !="adminteacher")
          classUsers.push(students[u].useremail);
      }
    user.find({email:{$in:classUsers}},function(e,users2){
      for (var us in users2){
        users[users2[us].email]=users2[us].name;
      }

    res.render('enrolstudents',{title:'Please specify the email of your students to add : ',users:users,user:req.user,classId:classId});  });  

   });
   });
  });


router.post("/enrolstudents",isLoggedIn, function(req, res) {
   var emails=req.body.studentsEmails.split("\n");
   var classId=req.body.classId;
   classinfo.findById(classId,{},function(e,class1){
     for ( email in emails)
     { 
        var result = coursesUsers.update({"useremail":emails[email].replace(/\s/g,'')},{$set:{"role":"student",codePin:class1.classPin}},{upsert:true});
        var result2= user.update({"email":emails[email].replace(/\s/g,'')},{$set:{"role":"student"}},{upsert:true});
     }
     res.redirect("/enrolstudents/"+classId)
    });

});
router.post("/unenrollstudents",isLoggedIn, function(req, res) {
  var classId=req.body.classId;
  var email=req.body.email;
  console.log(email);
  console.log(classId);
  classinfo.findById(classId,{},function(e,class1){
    coursesUsers.remove({"useremail":email,codePin:class1.classPin},function(err,doc){
      if(err){
        console.log("error")
        res.send("error unenrolling the student from the class");}
      else{
         console.log("sucess")
        res.send("unenrollstudent successful")}
    });
  });
});

router.post('/addnewTA',isLoggedIn, function(req, res) {
  var emails=req.body.TAemails.split("\n");
  var db = req.db;
  var user=db.get('User');
  var classId=req.body.classId;
  classinfo.findById(classId,{},function(e,class1){
   for ( email in emails)
   { 
    var result = coursesUsers.update({"useremail":emails[email].replace(/\s/g,'')},{$set:{"role":"adminteacher",codePin:class1.classPin}},{upsert:true});
    var result2 = user.update({"email":emails[email].replace(/\s/g,'')},{$set:{"role":"student"}},{upsert:true});
   }
     
  
  res.redirect("/addTA/"+classId);
});
});

router.get('/addTA/:classId',isLoggedIn,isAdmin,function(req,res){    
  var classId=req.params.classId;
  var classUsers=[];
  var users={};
  classinfo.findById(classId,{},function(e,class1){
    coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1},},function(e,students){
    for (var u in students){
    if (students[u].role =="adminteacher")
    classUsers.push(students[u].useremail);
    }
    user.find({email:{$in:classUsers}},function(e,users2){
      for (var us in users2){
        users[users2[us].email]=users2[us].name;
    }
    console.log(users);
    res.render('newTA',{title:'Please specify the email of your TA : ',"admins":users,user:req.user,classId:req.params.classId});  });  
  });});
  });
router.get('/summary/submission/:classId/:id/:show',isLoggedIn,function(req,res){
       var counthashcompile= new Object();
       var counthashnocompile= new Object();
       var studentsgood = new Object();
       var studentscompile = new Object();
       var hashpercent={}
       var studentNo=0;
       var show=req.params.show;
       var classId=req.params.classId;
       var classUsers=[];
       var users=[]
       classinfo.findById(classId,{},function(e,class1){
           coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1}},function(e,students){
           for (var u in students){
             if (students[u].role !="adminteacher")
               classUsers.push(students[u].useremail);
           }
       
       user_problems.distinct('hashtest',{pid:req.params.id,"useremail":{$in:classUsers}},function(e,hashvalues){
        console.log(hashvalues)
        user_problems.find({pid:req.params.id,"useremail":{$in:classUsers}},function(e,hashvaluesall){

        for( i  in  hashvalues)
        {
          var goodcount=0;
          var compcount=0;
         
          
          for (j in hashvaluesall ){
            hashpercent[hashvaluesall[j].hashtest]=hashvaluesall[j].percentcorrect
            if ( hashvalues[i]==hashvaluesall[j].hashtest)
            { 
              if(hashvaluesall[j].compliererror =="false"){
              goodcount=goodcount+1;
              if(hashvalues[i] in studentsgood==false)
                studentsgood[hashvalues[i]]=[]
              studentsgood[hashvalues[i]].push (hashvaluesall[j].username);}
            else{
             compcount=compcount+1;
              if(hashvalues[i] in studentscompile==false)
                 studentscompile[hashvalues[i]]=[]
             studentscompile[hashvalues[i]].push (hashvaluesall[j].username);
            }
          }
          }
          if ( hashvalues[i]!=null){

            if(hashvalues[i] in studentsgood){
            counthashnocompile[hashvalues[i]]=goodcount ;
            studentNo=studentNo+goodcount;}
            else{
              counthashcompile[hashvalues[i]]=compcount;
              studentNo=studentNo+compcount;
            }
          }
         var keysSortedNocompile = Object.keys(counthashnocompile).sort(function(a,b){return counthashnocompile[b]-counthashnocompile[a]});
         var keySortedCompile=Object.keys(counthashcompile).sort(function(a,b){return counthashcompile[b]-counthashcompile[a]});
   
        }
          console.log(hashpercent)
          PROBLEMS.findById(req.params.id,{},function(e,problems){
             res.render('summary',{hashpercent:hashpercent,result2:counthashcompile,result1:counthashnocompile, keyresult1:keysSortedNocompile,keyresult2:keySortedCompile,resultlength:hashvalues.length,id:req.params.id,compilererrors:studentscompile,students:studentsgood,problems:problems,studentNo:studentNo,user:req.user,classId:req.params.classId,show:show} );
            });
           
       });
        
     });
      });
         
    });      
    });  

router.get('/classes/problems/:classId/:problemsetId',isLoggedIn, function(req, res) {
   if((req.params.classId=="587e2642b9163bcd44dae90b")==true && (re.test(req.user.email)==false)){
    res.render("login",{message:"Error you have to login with brandeis unit id"});
   }
   else{
  var classId=req.params.classId.toString();
  var problemsetId=req.params.problemsetId.toString();
  var correctIds1=[];
  var psaccessflag=false;
  user_problems.find({"useremail":req.user.email,"percentcorrect":100},function (e,correctIds){
     for (id1 in correctIds)
      correctIds1.push(correctIds[id1].pid);
  PROBLEMS.find({"classId":classId,"problemsetId":problemsetId},{sort: { _id: 1}},function(e,docs){
            problemset.findById(problemsetId,{},function(e,problemsets){
            classinfo.findById((classId),{},function(e,classinfom){
              coursesUsers.findOne({"useremail":req.user.email,"codePin":classinfom.classPin},function(e,userinfo){
                ps_active.find({"email":req.user.email,"psid":problemsetId,"pin":problemsets.pin},function(e,psaccess){
                if(psaccess!=undefined && psaccess.length>0)
                  psaccessflag=true;
          res.render('problems', {ps:problemsets,psaccessflag:psaccessflag,
            "problemsList" : docs ,userinfo:userinfo,user:req.user,classId:classId,classinfom:classinfom,problemsetId:problemsetId,pname:problemsets.pname,correctIds1:correctIds1,inst:problemsets.pinst
          });
        });
        });
        });
         });
   });         });
 
}

});

// router.post("/unenrollnow", isLoggedIn, function (req,res){
//  var classId=req.body.classId;
//   var email=req.body.studentsEmails.split("\n");
//   console.log(email);
//   console.log(classId);
//   classinfo.findById(classId,{},function(e,class1){
//     coursesUsers.find({codePin:class1.classPin,role:"student"},function(err,students){
//       for (s in students){
//         if(email.indexOf(students[s].useremail)<0)
//            coursesUsers.remove({codePin:class1.classPin,role:"student",useremail:students[s].useremail});
//      }
//      res.redirect("enrolstudents/"+classId);
//     });
//   });
// });

router.post('/saveproblem', isLoggedIn,function (req,res)
{   
  console.log("Iam saving");
    var db = req.db;
    var user_problem_save=db.get('user_lastsave');
    var useremail=req.user.email;
    var pid=req.body.pid;
    var solution=req.body.sol;
     user_problem_save.update({
        "pid" : pid,
        "useremail" : useremail},{$set:{"solution":solution}},{upsert:true});
    
       res.send("");
});


router.get("/debugstat/:classId/:psid/:pid/:show",isLoggedIn,function (req,res){
  var pid=req.params.pid;
  var classId=req.params.classId;
  var psid=req.params.psid;
  var debuggedUsers=new sets.Set();
  var errorId_bugTypes={};
  var errorId_users={};
  var errorId_count={};
  var sortedId=[];
  var show=req.params.show;
  var classUsers=[];
  var users={}
  var  hashtest_users={};
  var error_frequent={};
   classinfo.findById(classId,{},function(e,class1){
    coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1}},function(e,students){
     for (var u in students){
         classUsers.push(students[u].useremail);
     }
     user.find({email:{$in:classUsers}},function(e,users2){
       for (var us in users2){
        users[users2[us].email]=users2[us].name
      }
    user_allSolutions.col.aggregate({"$match":{"pid":req.params.pid,"percentcorrect":{$ne:100}}},{$group:{_id:{hashtest:"$hashtest"},"solution_id":{$addToSet:"$_id"},"useremails":{$addToSet:"$useremail"}}},{$sort:{time:-1}}, function(e,solutions){
    for (var s in solutions){
        
        hashtest_users[solutions[s]._id.hashtest]=solutions[s].useremails.length;
   }
 
  debugcrowdsource.col.aggregate({"$match":{"pid":pid,"classId":classId,"problemsetId":psid}},{$group:{_id:{error_id:"$error_id",hashtest:"$hashtest"},"error_useremail":{$addToSet:"$useremail"},"bugtype":{$push:"$bugtype"}}}, function(e,debugproblems){
   for (var dp in debugproblems ){
     for (var x in debugproblems[dp].error_useremail)
      debuggedUsers.add(debugproblems[dp].error_useremail[x])
    error_debugType(errorId_bugTypes,debugproblems[dp]._id.error_id,debugproblems[dp].bugtype)
    errorId_users[debugproblems[dp]._id.error_id]=debugproblems[dp].error_useremail;
   errorId_count[debugproblems[dp]._id.error_id]=debugproblems[dp].error_useremail.length;
   error_frequent[debugproblems[dp]._id.error_id]=hashtest_users[debugproblems[dp]._id.hashtest]
  }
  console.log(error_frequent)
 sortedId=Object.keys(errorId_count).sort(function(a,b){return errorId_count[b]-errorId_count[a]});
  PROBLEMS.find({_id:pid,"classId":classId,"problemsetId":psid},function(e,p1){
    res.render("debugsummary",{error_frequent:error_frequent,users:users,show:show,p1:p1[0],pid:pid,psid:psid,classId:classId,user:req.user,debuggedUsers:debuggedUsers,errorId_bugTypes:errorId_bugTypes,sortedId:sortedId,errorId_users:errorId_users,errorId_count:errorId_count})
  });
   });
});
});
 });
});
});
router.get("/debug/:classId/:pid/:error_id",isLoggedIn,function(req,res){
  var classId=req.params.classId
  var pid=req.params.pid;
  var error_id=req.params.error_id;
  var errorId_idonotknow=[];
  var errorId_incomplete=[];
  var errorId_syntax=[];
  var errorId_logic=[];
  var user_comment=""
  var host="http://"+req.headers.host +"/";
  var admins=[];
 
 debugcrowdsource.find({classId:classId,pid:pid,error_id:error_id},function(e,comments){
  for(c in comments){
       if(comments[c].useremail==req.user.email)
       user_comment=comments[c].bugtype+"/////$$$$$"+comments[c].comment;
      if(comments[c].bugtype=="dontknow")
        errorId_idonotknow.push(comments[c].comment)
      else if(comments[c].bugtype=="Syntaxerror")
        errorId_syntax.push(comments[c].comment)
      else if(comments[c].bugtype=="logicerror")
        errorId_logic.push(comments[c].comment)
       else if(comments[c].bugtype=="incomplete")
        errorId_incomplete.push(comments[c].comment)
     }
  classinfo.findById(classId,{},function(e,class1){
    coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1}},function(e,students){
     for (var u in students){
       if (students[u].role =="adminteacher")
         admins.push(students[u].useremail)
     }
  PROBLEMS.findById(new ObjectID(pid),function(e,problem1){
  user_allSolutions.findById(new ObjectID(error_id),function(e,errorcode){
    console.log(errorcode.solution)
    res.render("debugview.ejs",{admins:admins,error_id:error_id,problem1:problem1,errorcode:errorcode.solution,user_comment:user_comment,errorId_idonotknow:errorId_idonotknow,errorId_incomplete:errorId_incomplete,errorId_syntax:errorId_syntax,errorId_logic:errorId_logic,host:host,hash:errorcode.hashtest})
  });
 });
});
});
  });
    });
function error_debugType(dict,error_id,array){
  if(error_id in dict==false)
    dict[error_id]=[0,0,0,0]// i do not know,incomplete,syntaxerror, logic error
  else
    for ( var i in array)
      if (array[i]=="dontknow")
        dict[error_id][0]+=1;
      else if(array[i]=="incomplete")
         dict[error_id][1]+=1
      else if(array[i]=="Syntaxerror")
           dict[error_id][2]+=1
      else
         dict[error_id][3]+=1
}
//maybe add the time
router.post('/addcomment', isLoggedIn,function (req,res)
{   
    var useremail=req.user.email;
    var pid=req.body.pid;
    var classId=req.body.classId;
    var problemsetId=req.body.problemsetId;
    var comment=req.body.comment;
    var bugtype=req.body.bugtype;
    var error_id=req.body.error_id;
    var hashtest=req.body.hashtest
    var errorId_idonotknow=[];
    var errorId_incomplete=[];
    var errorId_syntax=[];
    var errorId_logic=[];
    var hashtest_ids={};
    var hashtest_users={};
    var ids_solutions={};
    console.log('error_id')
      console.log(error_id)
    debugcrowdsource.update({
        "pid" : pid,
        "useremail" : useremail,"classId":classId,"problemsetId":problemsetId,"error_id":error_id,"hashtest":hashtest},{$set:{"comment":comment,"bugtype":bugtype}},{upsert:true},function(e,doc){
    debugcrowdsource.find({"pid":pid,"error_id":error_id },function (e,comments){
     for(c in comments){
        if(comments[c].bugtype=="dontknow")
          errorId_idonotknow.push(comments[c].comment)
        else if(comments[c].bugtype=="Syntaxerror")
          errorId_syntax.push(comments[c].comment)
        else if(comments[c].bugtype=="logicerror")
          errorId_logic.push(comments[c].comment)
        else if(comments[c].bugtype=="incomplete")
          errorId_incomplete.push(comments[c].comment)
     }

  var errorId_idonotknowdic={};
  var errorId_incompletedic={};
  var errorId_syntaxdic={};
  var errorId_logicdic={};
 

 // fix this to include comments depend on the hashtest not the error id
  debugcrowdsource.find({'hashtest':hashtest},function(e,debugcomments){
    for (var d in debugcomments){
      if(debugcomments[d].error_id in errorId_idonotknowdic==false )
        errorId_idonotknowdic[debugcomments[d].error_id]=[];
      if(debugcomments[d].error_id in errorId_incompletedic==false )
        errorId_incompletedic[debugcomments[d].error_id]=[];
      if(debugcomments[d].error_id in errorId_syntaxdic==false )
        errorId_syntaxdic[debugcomments[d].error_id]=[];
      if(debugcomments[d].error_id in errorId_logicdic==false )
        errorId_logicdic[debugcomments[d].error_id]=[];
      if(debugcomments[d].bugtype=="dontknow")
        errorId_idonotknowdic[debugcomments[d].error_id].push(debugcomments[d].comment)
      else if(debugcomments[d].bugtype=="Syntaxerror")
        errorId_syntaxdic[debugcomments[d].error_id].push(debugcomments[d].comment)
      else if(debugcomments[d].bugtype=="logicerror")
        errorId_logicdic[debugcomments[d].error_id].push(debugcomments[d].comment)
       else if(debugcomments[d].bugtype=="incomplete")
        errorId_incompletedic[debugcomments[d].error_id].push(debugcomments[d].comment)
     
    }
    user_allSolutions.col.aggregate({"$match":{"pid":pid,"percentcorrect":{$ne:100}}},{$group:{_id:{hashtest:"$hashtest"},"solution_id":{$addToSet:"$_id"},"useremails":{$addToSet:"$useremail"}}},{$sort:{time:1}}, function(e,solutions){ // this will return the document in decending order
    for (var s in solutions){
      if(solutions[s].useremails.length>1){
        hashtest_ids[solutions[s]._id.hashtest]=solutions[s].solution_id;//give me the ids in correct order from first to last
        
        hashtest_users[solutions[s]._id.hashtest]=solutions[s].useremails.length;
   }}
    var sorter=sortByValue(hashtest_users); // sort hash by the number of students who submit it
      
   user_allSolutions.find({pid:pid,"percentcorrect":{$ne:100}},function(e,allSolutions){
    for(var as in allSolutions){
       if(allSolutions[as].solution.trim().length==0 && hashtest_ids[allSolutions[as].hashtest] !=undefined){
        var x=findIndex( hashtest_ids[allSolutions[as].hashtest],allSolutions[as]._id)
         if (x>-1)
         hashtest_ids[allSolutions[as].hashtest].splice( x,1)
       }
       else if (hashtest_ids[allSolutions[as].hashtest] !=undefined)
       ids_solutions[allSolutions[as]._id]=allSolutions[as].solution
      }
    
     console.log(ids_solutions)
    res.send({ids_solutions:ids_solutions,hashtest_ids:hashtest_ids,sorter:sorter,previousId_idonotknow:errorId_idonotknow, previousId_syntax: errorId_syntax,previousId_logic:errorId_logic,previousId_incomplete:errorId_incomplete,incompletedic:errorId_incompletedic,logicdic:errorId_logicdic,syntaxdic:errorId_syntaxdic,idontknowdic:errorId_idonotknowdic});
    });
   });
});
    });
    });   
});
router.get("/debug/:pid",isLoggedIn, function(req, res) {
  var hashtest_ids={};
  var hashtest_users={};
  var ids_solutions={};
  var host="http://"+req.headers.host +"/";
  var errorId_idonotknow={};
  var errorId_incomplete={};
  var errorId_syntax={};
  var errorId_logic={};
  var user_comment={};
  var hash_idonotknow={};
  var hash_incomplete={};
  var hash_syntax={};
  var hash_logic={};

 // this will show in general but I want specific to error_id fix it with dictionary for each bug type where the key is error_id;
  debugcrowdsource.find({'pid':req.params.pid},function(e,debugcomments){
    for (var d in debugcomments){
      if(debugcomments[d].useremail==req.user.email)
       user_comment[debugcomments[d].error_id]=debugcomments[d].bugtype+"/////$$$$$"+debugcomments[d].comment;
      if(debugcomments[d].error_id in errorId_idonotknow==false )
        errorId_idonotknow[debugcomments[d].error_id]=[];
      if(debugcomments[d].error_id in errorId_incomplete==false )
        errorId_incomplete[debugcomments[d].error_id]=[];
      if(debugcomments[d].error_id in errorId_syntax==false )
        errorId_syntax[debugcomments[d].error_id]=[];
      if(debugcomments[d].error_id in errorId_logic==false )
        errorId_logic[debugcomments[d].error_id]=[];
      if(debugcomments[d].bugtype=="dontknow")
        errorId_idonotknow[debugcomments[d].error_id].push(debugcomments[d].comment)
      else if(debugcomments[d].bugtype=="Syntaxerror")
        errorId_syntax[debugcomments[d].error_id].push(debugcomments[d].comment)
      else if(debugcomments[d].bugtype=="logicerror")
        errorId_logic[debugcomments[d].error_id].push(debugcomments[d].comment)
       else if(debugcomments[d].bugtype=="incomplete")
        errorId_incomplete[debugcomments[d].error_id].push(debugcomments[d].comment)
       addtoDict(hash_incomplete,debugcomments[d].hashtest,debugcomments[d].comment,debugcomments[d].bugtype,"incomplete")
       addtoDict(hash_idonotknow,debugcomments[d].hashtest,debugcomments[d].comment,debugcomments[d].bugtype,"dontknow")
       addtoDict(hash_syntax,debugcomments[d].hashtest,debugcomments[d].comment,debugcomments[d].bugtype,"Syntaxerror")
       addtoDict(hash_logic,debugcomments[d].hashtest,debugcomments[d].comment,debugcomments[d].bugtype,"logicerror")
    }
   
  PROBLEMS.findById(req.params.pid,function(e,problem1){
  user_allSolutions.col.aggregate({"$match":{"pid":req.params.pid,"percentcorrect":{$ne:100}}},{$group:{_id:{hashtest:"$hashtest"},"solution_id":{$addToSet:"$_id"},"useremails":{$addToSet:"$useremail"}}},{$sort:{time:1}}, function(e,solutions){ // this will return the document in decending order
    for (var s in solutions){
      if(solutions[s].useremails.length>1){
        hashtest_ids[solutions[s]._id.hashtest]=solutions[s].solution_id;//give me the ids in correct order from first to last
        
        hashtest_users[solutions[s]._id.hashtest]=solutions[s].useremails.length;
   }}
    var sorter=sortByValue(hashtest_users); // sort hash by the number of students who submit it
      
   user_allSolutions.find({pid:req.params.pid,"percentcorrect":{$ne:100}},function(e,allSolutions){
    for(var as in allSolutions){
       if(allSolutions[as].solution.trim().length==0 && hashtest_ids[allSolutions[as].hashtest] !=undefined){

        console.log(hashtest_ids[allSolutions[as].hashtest].length)
        var x=findIndex( hashtest_ids[allSolutions[as].hashtest],allSolutions[as]._id)
         if (x>-1)
         hashtest_ids[allSolutions[as].hashtest].splice( x,1)
           console.log(hashtest_ids[allSolutions[as].hashtest].length)
       }
       else if (hashtest_ids[allSolutions[as].hashtest] !=undefined)
       ids_solutions[allSolutions[as]._id]=allSolutions[as].solution
      }
      console.log(sorter)// give the order in asending
      console.log(hashtest_users);
      res.render("debug.ejs",{user:req.user,pid:req.pid,problem1:problem1,hashtest_ids:hashtest_ids,hashtest_users:hashtest_users,ids_solutions:ids_solutions,host:host,sorter:sorter,errorId_incomplete:errorId_incomplete,errorId_logic:errorId_logic,errorId_syntax:errorId_syntax,errorId_idonotknow:errorId_idonotknow,user_comment:user_comment,hash_incomplete:hash_incomplete,hash_idonotknow:hash_idonotknow,hash_syntax:hash_syntax,hash_logic:hash_logic});
  });
    });
   });
 });
});

function findIndex(array, a){
  for ( var i in array)
    if (array[i].toString()==a.toString())
      return i;
  return -1;
}
// dic values is array  so passed value will be added to the dic
function addtoDict(dic,key,value,condition,testvalue){
  if(key in dic==false)
    dic[key]=[]
  if(condition==testvalue)
    dic[key].push(value)

}
router.get("/getproblemsdata",isLoggedIn, function(req, res) {
  var classId="587e2642b9163bcd44dae90b";
  var classUsers=[]
  var users={};
  classinfo.findById(classId,{},function(e,class1){
    var classname=class1.cname + " "+ class1.cSemester+ " / "+ class1.ccode;
  coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1}},function(e,students){
   for (var u in students){
     if (students[u].role !="adminteacher")
       classUsers.push(students[u].useremail);
   }
   user.find({email:{$in:classUsers}},function(e,users2){
     for (var us in users2){
      users[users2[us].email]=users2[us].name;
     }
   
   var useremails=Object.keys(users);
   console.log(useremails.length)
   var pid_steps={};
   var pid_nouser={};
   var pid_correctstep={};
   var pid_stepgiveup={}
   user_allSolutions.col.aggregate({"$match":{ "useremail" : { $in:useremails}}},{$group:{_id:{useremail:"$useremail",pid:"$pid"},ids:{$addToSet:"$_id"},percentcorrect:{$addToSet:"$percentcorrect"}}},{$sort:{pid:1}}, function(e,solutions){
      for (var s in solutions){
        if (solutions[s]._id.pid in pid_steps==false){
          pid_steps[solutions[s]._id.pid]=[];
          pid_correctstep[solutions[s]._id.pid]=[];
          pid_stepgiveup[solutions[s]._id.pid]=[];
        }
        pid_steps[solutions[s]._id.pid].push(solutions[s].ids.length);
        if(solutions[s].percentcorrect.indexOf(100)>-1)
         pid_correctstep[solutions[s]._id.pid].push(solutions[s].ids.length)
        else
         pid_stepgiveup[solutions[s]._id.pid].push(solutions[s].ids.length)
        }
      
   console.log(Object.keys(pid_steps).length)
   var count=0;
   var pids="Pno";
   var pidsNum="total student tried"
   var pidsaverage="p average number of steps"
   var pidsmedian=" p medain number of steps";
   var pidsgiveupaverage="p  give up average number of steps"
   var pidscorrectaverage="p  correct average number of steps"
   var pidsgiveupmedain="p  give up medain number of steps"
   var pidscorrectmedian="p  correct medain number of steps"
    for ( var p in pid_steps)  {
      pids=pids+','+count;
      pidsNum=pidsNum+","+pid_steps[p].length

      pidsaverage=pidsaverage+"," + average(pid_steps[p])
      if (pid_steps[p]!=undefined)
        pidsmedian=pidsmedian+","+median(pid_steps[p]);
      else
        pidsmedian=pidsmedian+","+"-1"
      pidsgiveupaverage=pidsgiveupaverage+","+average(pid_stepgiveup[p])
      if (pidsgiveupmedain[p]!=undefined)
        pidsgiveupmedain=pidsgiveupmedain+","+median(pidsgiveupmedain[p])
      else
        pidsgiveupmedain=pidsgiveupmedain+","+"-1"
      pidscorrectaverage=pidscorrectaverage+","+average(pid_correctstep[p])
      if(pid_correctstep[p]!=undefined)
      pidscorrectmedian=pidscorrectmedian+","+median(pid_correctstep[p])
      else
        pidscorrectmedian=pidscorrectmedian+","+"-1"
      count+=1;
    } 
    console.log(pids);
    console.log(pidsNum);
    console.log(pidsaverage)
    console.log(pidsmedian)
    console.log(pidsgiveupaverage)
    console.log(pidscorrectaverage)
    console.log(pidsgiveupmedain)
    console.log(pidscorrectmedian)
 });  
  });
  });
  });
  });
router.get("/geterror", isLoggedIn, function(req, res) {

});
router.get("/geterrordata", isLoggedIn, function(req, res) {
   // var date=req.params.date;
   //  if(date=="empty")
   //   date=new Date();
   // else{
   //   date= new Date(replaceAll(":","/",date).replace("*",":").replace("_"," "));

   // }

   date=new Date("Apr 3, 2017")
   date.setHours(10);
   var nexthourdate= new Date("Apr 3, 2017")
   nexthourdate.setHours(11)
   var overalproblemtime= new sets.Set();
   var hash_error={}
   
    
    user_allSolutions.col.aggregate({"$match":{"pid":"58e00d2d1071a000007e851a","time":{$gte:date,$lt:nexthourdate}}},{$group:{_id:{hashtest:"$hashtest",percentcorrect:"$percentcorrect",stderr:"$stderr",compliererror:"$compliererror"},ids:{$push:"$_id"},"time1":{$push:"$time"},"useremails":{$addToSet:"$useremail"}}},{$sort:{time1:1}}, function(e,solutions){
      var startime=solutions[0].time1[0].getTime();
      var error=""
      var allerror={};
    for (var s in solutions){

         var time2={}
         var count=0;
         hash_error[solutions[s]._id.hashtest]=solutions[s]._id.compliererror+","+solutions[s]._id.percentcorrect+","+solutions[s].ids.length+","+solutions[s].useremails.length+","+solutions[s]._id.stderr
          for (t in solutions[s].time1 ){

            var diff=solutions[s].time1[t].getTime()-startime;
            overalproblemtime.add(diff)
            count+=1;
            time2[diff]=count;
        }
     
      allerror[solutions[s]._id.hashtest]= JSON.parse(JSON.stringify(time2));}
      overalproblemtime=overalproblemtime.array();
      var hash={};
      var timetext="Time,"
      for ( var t in overalproblemtime ){
        timetext=timetext+overalproblemtime[t]+","
         for ( h in allerror){
           if (h in hash==false)
            hash[h]=""
           if (overalproblemtime[t] in allerror[h]==false)
           hash[h]=hash[h]+"0,"
           else 
            hash[h]=hash[h]+allerror[h][overalproblemtime[t]]+","
      }
      } 
      var prototype=""
      
       prototype=timetext+"\n"
       for (o in hash_error)
        console.log(o + ","+ hash_error[o])
      for(ha in hash)
       prototype+= ha + "," +hash[ha] +"\n"
       var stream = fs.createWriteStream(location1+"data.csv");
      stream.once('open', function(fd) {
      stream.write(prototype);
      stream.end();
   res.render("login");
});
      
});
  });   
router.get("/getdata/:id/:date",isLoggedIn, function(req, res) {
   var minutes_user={}; // who started in this minutes
   var minutes_finish={};// who finished in this minute
   var minutes_pressrun={};
   var all_solver=[]
   var solved_already=new sets.Set();
   var date=req.params.date;
   user_allSolutions.find({pid:req.params.id},{sort:{time:1}},function(e,timeproblems){
    if(date=="empty")
     date=new Date();
   else{
     date= new Date(replaceAll(":","/",date).replace("*",":").replace("_"," "));

   }
    for (var record in timeproblems){
    
    var diff=timeproblems[record].time;
      if(( diff.getHours()==10  && diff.getDate()==date.getDate() )){
         
        var minute=diff.getMinutes()
        if(minute==3)
        console.log(diff)
        
        if (minute in minutes_user ==false)
          minutes_user[minute]=new sets.Set();
        if (minute in minutes_finish==false)
          minutes_finish[minute]=new sets.Set();
        
        if(timeproblems[record].useremail!="tjhickey@brandeis.edu" && timeproblems[record].useremail!="abudeebf@brandeis.edu" && solved_already.has(timeproblems[record].useremail)==false){

           minutes_user[minute].add(timeproblems[record].useremail)
           all_solver.push(timeproblems[record].useremail);
        }
        if(timeproblems[record].percentcorrect==100 && (timeproblems[record].useremail!="tjhickey@brandeis.edu" && timeproblems[record].useremail!="abudeebf@brandeis.edu") && solved_already.has(timeproblems[record].useremail)==false){
          minutes_finish[minute].add(timeproblems[record].useremail);
          solved_already.add(timeproblems[record].useremail)
         }
        
         minutes_pressrun[minute]=new sets.Set(all_solver);  
      }
    }
   
     var comulativesolved=0;
     var comulativedidnotfinish=0;
     var m1="Minutes" 
     var started="stared did not finish"
     var solved="solved"
     var pressrun="pressrun"
     var printcomulativesolved="Comulative Solved"
     var printcomulativedidnotfinish="Comulative did not finish"
     var previousm="NAN"
     var minutes=[];
     var pressrunarray=[];
     var comulativesolvedarray=[];
     var comulativedidnotfinisharray=[];
     for(var m in  minutes_user ){
      m1=m1+","+m
      minutes.push(m)
      if(previousm!="NAN"){
      var startedatminute =minutes_user[m].difference(minutes_pressrun[previousm]);
      

      
      var starteddidnotfinish=startedatminute.difference(minutes_finish[m]);
      started=started+","+ starteddidnotfinish.size()}
      else{
        started=started+","+ minutes_user[m].size();
      }
      pressrun=pressrun+","+minutes_pressrun[m].size();
      pressrunarray.push( minutes_pressrun[m].size());
      comulativesolved=comulativesolved+minutes_finish[m].size();
      comulativedidnotfinish=minutes_pressrun[m].size()-comulativesolved;
      solved=solved+','+minutes_finish[m].size();
      printcomulativesolved=printcomulativesolved+","+comulativesolved;
      comulativesolvedarray.push(comulativesolved);
      printcomulativedidnotfinish=printcomulativedidnotfinish+","+comulativedidnotfinish
      comulativedidnotfinisharray.push(comulativedidnotfinish);
      previousm=m;
     }
    console.log(m1);
    console.log(pressrun);
    console.log(printcomulativedidnotfinish)
    console.log(printcomulativesolved)
    console.log(started);
    console.log(solved);

    total_debug_minutes={};
    user_debugtotal={};
   debugcrowdsource.find({'pid':req.params.id},{sort:{_id:1}},function(e,debugcomments){
    for (c in debugcomments){
     var date2=dateFromObjectId(debugcomments[c]._id.toString());
     if(date2.getHours()==10 && date2.getDate()==date.getDate() )
    {
      var m2=date2.getMinutes();
      if(m2 in  total_debug_minutes==false)
         total_debug_minutes[m2]=[];
      if(debugcomments[c].useremail!="tjhickey@brandeis.edu" && debugcomments[c].useremail!="abudeebf@brandeis.edu"){
         total_debug_minutes[m2].push(debugcomments[c].useremail)
       if (debugcomments[c].useremail in user_debugtotal==false)
        user_debugtotal[debugcomments[c].useremail]=0
        user_debugtotal[debugcomments[c].useremail]+=1;
    }
    }
    
   }
   var min="minutes";
   var comulativesubmittdebugging="# comulative distinct students submit debugcomments up to this minute";
   var csdarray=[];
   var submittdebugging="# distinct students submit debugcomments in this minute";
   var comulativedebug=new sets.Set();
   var comulativetotal=0;
   var finsiheddidnotdebug=" # all did not debug"
   var totalsubmittedcomment=" # total submitted comment in this minute"
   var comulativetotalsubmittedcomment=" total submitted comments up to this minute"
   var arraycommentstotal=[];
   var uniquetotal=[];
   var fdd=0;
   var commulativefdd=new sets.Set();
   var comulativesolved2=new sets.Set();
   var comulativefddarray=[];
   var i=0;
   for (var m3 in  minutes_user ){
     min=min +","+m3;
     if (m3 in total_debug_minutes==false){
      submittdebugging=submittdebugging+",0"
      totalsubmittedcomment=totalsubmittedcomment+",0";
      comulativesubmittdebugging=comulativesubmittdebugging+","+comulativedebug.size()
      csdarray.push(comulativedebug.size());
      uniquetotal.push(comulativedebug.size())
      finsiheddidnotdebug=finsiheddidnotdebug+","+fdd;
      comulativefddarray.push(fdd)
      arraycommentstotal.push(comulativetotal)
      comulativetotalsubmittedcomment=comulativetotalsubmittedcomment+","+comulativetotal;
      i++
     }
     else{
     comulativedebug=comulativedebug.union(new sets.Set(total_debug_minutes[m3]))
     comulativesubmittdebugging=comulativesubmittdebugging+","+comulativedebug.size()
      csdarray.push(comulativedebug.size());
     submittdebugging=submittdebugging+","+new sets.Set(total_debug_minutes[m3]).size();
     comulativesolved2= comulativesolved2.union(minutes_finish[m3]);
     fdd=comulativesolved2.difference(comulativedebug).size();
     fdd=fdd+comulativedidnotfinisharray[i]
     i++;
     finsiheddidnotdebug=finsiheddidnotdebug+","+fdd;
     comulativefddarray.push(fdd)
     totalsubmittedcomment=totalsubmittedcomment+","+total_debug_minutes[m3].length;
     comulativetotal=comulativetotal+total_debug_minutes[m3].length;
     uniquetotal.push(total_debug_minutes[m3].length)
     comulativetotalsubmittedcomment=comulativetotalsubmittedcomment+","+comulativetotal;}
     arraycommentstotal.push(comulativetotal)
   }
    console.log(min)
    console.log(submittdebugging)
    console.log(totalsubmittedcomment)
    console.log(comulativesubmittdebugging)
    console.log(finsiheddidnotdebug);
    console.log(comulativetotalsubmittedcomment);
    console.log(minutes)
    console.log(comulativedidnotfinisharray)
    console.log(pressrunarray)
    res.render("chart",{csdarray:csdarray,pid:req.params.id,date:date,comulativefddarray:comulativefddarray,minutes:minutes,pressrunarray:pressrunarray,arraycommentstotal:arraycommentstotal,uniquetotal:uniquetotal,comulativesolvedarray:comulativesolvedarray,comulativedidnotfinisharray:comulativedidnotfinisharray}) 
  });                   
  });
   });
router.get("/debugdata",isLoggedIn, function(req, res) {
  debugcrowdsource.find({'pid':"58d27f13c696e60000e5c68a"},function(e,debugcomments){
    for (c in debugcomments){
      console.log(dateFromObjectId(debugcomments[c]._id.toString()) +","+debugcomments[c].useremail )
    }
    res.render("login")
  });
});

router.get('/:problemId',isLoggedIn, function(req, res) {
  var problemId=req.params.problemId;
  var solutions="";
  var scounts=0;
  if(problemId.indexOf("[]")>0){
   problemId=problemId.split("[]");
   var classId=problemId[0];
   var db=req.db;
  var minR=problemId[3];
  var id1=problemId[1];
  var collection =db.get('userSoultionsToProblems');
  var result= {};
  var k="0";
  var section="All";
  k=problemId[2];
  section=problemId[4];
  var show=problemId[5]
  var counthash= new Object();
  var alises = {};
  var percent=new Object();
  var completeHash=[];
  var passedTesthash=new sets.Set();
  var passedTesthash2=new sets.Set();
  var nodesName={};
  var hash_code={};
  var hash_names={};
  var hash_node={};
  var self_node={};
  var start_no=0;
  var gaveup_no=0;
  var graph = new Graph;
  var uUsers={};
  var fromCount={};
  var sectionvalue="";
  var users={};
  
  classinfo.findById(classId,{},function(e,cinfo){
   coursesUsers.find({codePin:cinfo.classPin,useremail: {$regex : /@brandeis.edu/},role:{$ne:"adminteacher"}},{sort:{name:1}},function(e,students){
   for (var u in students){
     users[students[u].useremail]="";
   }
   var useremails=Object.keys(users);
   user.find({email:{$in:useremails}} ,{sort:{name:1}},function(e,students2){
    for (var u in students2){
     users[students2[u].email]=students2[u].name;
   }
  if ( section=="All")
  sectionvalue = {
       "pid" :id1 ,
       "hashtest"  : {$not: {$size: 0},$ne:null,$exists: true} ,"useremail":{$in:useremails}};
  else
    sectionvalue  = {
       "pid" :id1 ,
       "hashtest"  : {$not: {$size: 0},$ne:null,$exists: true },
       "section" :section,"useremail":{$in:useremails}};  
  collection.find(sectionvalue,{sort:{useremail:1,time:1}} ,function(e,hashvalues){
      if (Object.keys(hashvalues).length>0){
        var useremail1 =hashvalues[0].useremail;
        var hashvalue=hashvalues[0].hashtest.trim();
        alises[hashvalue]=Object.keys(alises).length
        // count the number of the same code was tried 
        for (var  h in hashvalues)
        {
            if (hashvalues[h].hashtest!=null )
            {
              if(hashvalues[h].hashtest.trim() in uUsers==false){
                uUsers[hashvalues[h].hashtest.trim()]=new sets.Set();
              }
              uUsers[hashvalues[h].hashtest.trim()].add(hashvalues[h].useremail)
              if (hashvalues[h].hashtest.trim() in percent==false){
                if (hashvalues[h].percentcorrect!=null)
                 percent[hashvalues[h].hashtest.trim() ]=hashvalues[h].percentcorrect;
                else{
                 percent[hashvalues[h].hashtest.trim() ]=0; 
                }
              }
              if (hashvalues[h].hashtest.trim() in counthash)
                counthash[hashvalues[h].hashtest.trim() ]=counthash[hashvalues[h].hashtest.trim() ]+1;
              else
                counthash[hashvalues[h].hashtest.trim() ]=1;  
              if (hashvalues[h].percentcorrect==100)
              {   console.log(hashvalues[h].hashtest.replace(/\s/g,''))
                  passedTesthash.add(hashvalues[h].hashtest.trim());
                  passedTesthash2.add(hashvalues[h].hashtest.trim());
              } 
              if (hashvalues[h].hashtest.trim() in hash_code==false){ // to store the code related to one hashcode
                    hash_code[hashvalues[h].hashtest.trim()]=new sets.Set();
                    hash_names[hashvalues[h].hashtest.trim()]=new sets.Set();
              }
                hash_code[hashvalues[h].hashtest.trim()].add(hashvalues[h].solution);
                hash_names[hashvalues[h].hashtest.trim()].add(hashvalues[h].useremail)     
            }
        }
        var start="start"
        var h=0;
        var x="";
        var complete=false;
        while ( hashvalues[h+""]!==undefined)
        { 
            if (h==0)
            {
                if (uUsers[hashvalues[h+""].hashtest.trim()].size()<=k){
                  h=findnexthash(uUsers,useremail1,hashvalues,h,k); 
                }
                if(h>=0)
                {
                  if (hashvalues[h+""].hashtest.trim() in alises ==false)
                            alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
                  x="0->" + hashvalues[h+""].hashtest.trim();
                  if(x in result)
                            result[x]=result[x]+1;
                          else 
                            result[x]=1;
                  nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                }
                else 
                {
                       x="0" + "->1";
                       if(x in result)
                        result[x]=result[x]+1;
                       else 
                        result[x]=1;
                       useremail1 =hashvalues[h*(-1)+""].useremail;
                       while ( h<0 && hashvalues[(h*-1)+""]!==undefined)
                       {
                          if(x in result)
                            result[x]=result[x]+1;
                          else 
                            result[x]=1;
                          var t=h*(-1);
                          useremail1=hashvalues[t+""].useremail;
                          h=findnexthash(uUsers,useremail1,hashvalues,t,k); 
                        }
                      if (h>0 && hashvalues[h+""]!==undefined)
                      {  
                         useremail1=hashvalues[(h+"")].useremail;
                         if (hashvalues[h+""].hashtest.trim() in alises ==false)
                            alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
                         x="0->" + hashvalues[h+""].hashtest.trim();
                         nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                         if(x in result)
                            result[x]=result[x]+1;
                          else 
                            result[x]=1;
                      }
                      else 
                      { 
                        h=h*-1;
                        complete=true;
                      }
                }
            } //end if h==0
            if ( !complete )
            {
              useremail1 =hashvalues[h+ ""].useremail;
              if (hashvalues[h+""].hashtest.trim() in alises ==false)
                alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
              var m=h+1;
              if (hashvalues[m+""]!== undefined ){
                    if (uUsers[hashvalues[m+""].hashtest.trim()].size()<=k)
                      m=findnexthash(uUsers,useremail1,hashvalues,m,k); 
                      if (m>0 && useremail1==hashvalues[m+ ""].useremail)
                      {   // if I am creating the steps for the same user 
                          if(hashvalues[m+""]!= undefined) 
                          {
                              if (hashvalues[h+""].hashtest.trim() in alises ==false)
                                  alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
                              if (hashvalues[m+""].hashtest.trim() in alises ==false)
                                  alises[hashvalues[m+""].hashtest.trim()]= Object.keys(alises).length
                              x=hashvalues[h+""].hashtest.trim() + "->" + hashvalues[m+""].hashtest.trim();
                              nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                              nodesName[hashvalues[m+""].hashtest.trim()]=alises[hashvalues[m+""].hashtest.trim()]+"_"+ counthash[hashvalues[m+""].hashtest.trim()] +"_" +percent[hashvalues[m+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[m+""].hashtest.trim()].size();
                              if(x in result){
                                  result[x]=result[x]+1;}
                              else 
                              {  
                                result[x]=1;
                                fromCount[x]=counthash[hashvalues[h+""].hashtest.trim()];
                              }
                              if (hashvalues[m+""].hashtest.trim()==hashvalues[h+""].hashtest.trim())
                                self_node[hashvalues[m+""].hashtest.trim()]=x;
                              if (passedTesthash.has(hashvalues[h].hashtest.trim()))
                              {
                                hash_node[hashvalues[h+""].hashtest.trim()]="\""+alises [hashvalues[h+""].hashtest.trim()] +"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size() +"\"" +"[shape=doublecircle,color=red, fontcolor=blue,fillcolor=\""+ convertRGB(1-(percent[hashvalues[h+""].hashtest.trim()]/100),(percent[hashvalues[h+""].hashtest.trim()]/100),0)+"\", style=\"filled\""
                                passedTesthash.remove(hashvalues[h+""].hashtest.trim());
                              }
                              else if (passedTesthash.has(hashvalues[m+""].hashtest.trim()))
                              {
                                hash_node[hashvalues[m+""].hashtest.trim()]="\""+alises [hashvalues[m+""].hashtest.trim()] +"_"+ counthash[hashvalues[m+""].hashtest.trim()] +"_" +percent[hashvalues[m+""].hashtest.trim()].toFixed(0) +"%_" +uUsers[hashvalues[m+""].hashtest.trim()].size()+"\"" +"[shape=doublecircle,color=red, fillcolor=\""+ convertRGB(1-(percent[hashvalues[m+""].hashtest.trim()]/100),(percent[hashvalues[m+""].hashtest.trim()]/100),0)+"\", fontcolor=blue,style=\"filled\""
                                passedTesthash.remove(hashvalues[m+""].hashtest.trim());
                              }
                              else
                              {
                                if(passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false )
                                  hash_node[hashvalues[h+""].hashtest.trim()]="\""+alises [hashvalues[h+""].hashtest.trim()] +"_"+ counthash[hashvalues[h+""].hashtest.trim()]+"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size() +"\"[color=\""+ convertRGB(1-(percent[hashvalues[h+""].hashtest.trim()]/100),(percent[hashvalues[h+""].hashtest.trim()]/100),0)+"\", style=\"filled\",fontcolor=blue"
                                if (passedTesthash2.has(hashvalues[m+""].hashtest.trim())==false)
                                  hash_node[hashvalues[m+""].hashtest.trim()]="\""+alises [hashvalues[m+""].hashtest.trim()] +"_"+ counthash[hashvalues[m+""].hashtest.trim()]+"_" +percent[hashvalues[m+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[m+""].hashtest.trim()].size() +"\"[color=\""+ convertRGB(1-(percent[hashvalues[m+""].hashtest.trim()]/100),(percent[hashvalues[m+""].hashtest.trim()]/100),0)+"\", style=\"filled\",fontcolor=blue"
                              }
                              h=m;  
                          }//if(hashvalues[m+""]!= undefined) 
                          else
                          {
                            if ( passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false  ) 
                            {
                              x= hashvalues[h+""].hashtest.trim() +"->1";
                              nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                              if(x in result)
                                 result[x]=result[x]+1;
                              else 
                              {  result[x]=1;
                                 fromCount[x]=counthash[hashvalues[h+""].hashtest.trim()];
                              } 
                            }
                             h=m;
                             break;
                           }  
                        }// m>0 && useremail1==hashvalues[m+ ""].useremail
                        else
                        {
                          if(passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false)
                          {
                            x= hashvalues[h+""].hashtest.trim()+"->1";
                            nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                            if(x in result)
                                 result[x]=result[x]+1;
                            else 
                              {  result[x]=1;
                                 fromCount[x]=counthash[hashvalues[h+""].hashtest.trim()];

                              } 
                          }
                          if (m<0)
                            h=m*-1;
                          else  // in case we did not change the m but m was belong to another user
                            h=m;
                          if(hashvalues[h+""]!== undefined)
                          {
                             useremail1=hashvalues[h+""].useremail;
                             if (uUsers[hashvalues[h+""].hashtest.trim()].size()<=k)
                              h=findnexthash(uUsers,useremail1,hashvalues,h,k); 
                            if (h>=0 )
                            { 
                              useremail1=hashvalues[h+""].useremail;
                              if (hashvalues[h+""].hashtest.trim() in alises ==false)
                                alises[hashvalues[h+""].hashtest.trim()]= Object.keys(alises).length
                              x="0->" +hashvalues[h+""].hashtest.trim();
                              nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                              if(x in result)
                                result[x]=result[x]+1;
                              else 
                                result[x]=1;
                            }
                            else 
                            {
                              h=h*-1;
                              if(hashvalues[h+""]!== undefined)
                              {
                                  x="0->1" ;
                                  if(x in result)
                                     result[x]=result[x]+1;
                                  else 
                                     result[x]=1;
                                  useremail1=hashvalues[h+""].useremail;
                                  if (uUsers[hashvalues[h+""].hashtest.trim()].size()<=k)
                                    h=findnexthash(uUsers,useremail1,hashvalues,h,k); 
                                  while(h<0  && hashvalues[(-1*h)+""]!==undefined)
                                  {
                                    if(x in result)
                                       result[x]=result[x]+1;
                                    else 
                                       result[x]=1;
                                    var t=h*-1;
                                    useremail1=hashvalues[t+""].useremail;
                                    h=findnexthash(uUsers,useremail1,hashvalues,t,k); 
                                  }
                                  if (h>0 && hashvalues[""+h]!==undefined)
                                  {
                                    useremail1=hashvalues[h+""].useremail;
                                    if (hashvalues[h+""].hashtest.trim() in alises ==false)
                                      alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
                                     x="0->" + hashvalues[h+""].hashtest.trim();
                                     nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                                     if(x in result)
                                        result[x]=result[x]+1;
                                     else 
                                        result[x]=1;
                                  }
                                  else
                                  {
                                      complete=true;
                                      break;
                                  }  
                              }
                              else
                              {
                                
                                complete=true;
                                break;
                              }
                          }
                          if ( passedTesthash.has(hashvalues[h+""].hashtest.trim()))
                          {
                              hash_node[hashvalues[h+""].hashtest.trim()]="\""+alises [hashvalues[h+""].hashtest.trim()] +"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size() +"\"" +"[shape=doublecircle,color=red, fillcolor=\""+ convertRGB(1-(percent[hashvalues[h+""].hashtest.trim()]/100),(percent[hashvalues[h+""].hashtest.trim()]/100),0)+"\", fontcolor=blue,style=\"filled\""
                              passedTesthash.remove(hashvalues[h+""].hashtest.trim());
                  
                          }
                          else 
                          {
                              if( passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false  )
                                hash_node[hashvalues[h+""].hashtest.trim()]="\""+alises [hashvalues[h].hashtest.trim()] +"_"+ counthash[hashvalues[h+""].hashtest.trim()]+"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size() +"\"[color=\""+ convertRGB(1-(percent[hashvalues[h+""].hashtest.trim()]/100),(percent[hashvalues[h+""].hashtest.trim()]/100),0)+"\", style=\"filled\",fontcolor=blue";
                          }
                          }
                      }
                    }
                   else 
                   {
                    if ( passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false  ) 
                    {
                        x= hashvalues[h+""].hashtest.trim()+ "->1" ;
                        nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                            if(x in result)
                                 result[x]=result[x]+1;
                            else 
                              {  result[x]=1;
                                 fromCount[x]=counthash[hashvalues[h+""].hashtest.trim()];

                              }
                    }
                    complete=true;
                    break;
                  }
                }
              }
          var  start_no=0;
          var gaveup_no=0;
          for (var x in result )
          {
            if (x.split("->")[0]=="0")
              start_no=start_no+result[x];
            if ((x.split("->")[1]).trim()=="1")
              gaveup_no=gaveup_no+result[x];
          } 
          PROBLEMS.findById((id1),{},function(e,problem)
          {
            var host="http://"+req.headers.host +"/";
            res.render("realtimegraph.ejs",{problem1:problem,pNumbers:problem.pNumbers, retype:problem.retype,scafolding:problem.scafolding,sol:problem.sol,test:problem.test_generator,methodname:problem.methodname, nodesName:nodesName,alises:alises,percent:percent,counthash:counthash,start_no:start_no,gaveup_no:gaveup_no,fromCount:fromCount,result:result,self_node:self_node,id1:id1,section:section,pname:problem.pname,hash_code:hash_code,k:k,user:req.user,minR:minR,hash_names:hash_names,users:users,classId:classId,host:host,show:show});
          });
        }
        else
        {
          res.render('noresult',{user:req.user});
        }
      });
    }); 
  });
 });
}
  else if(problemId.indexOf("()")>0){
    console.log("in studentview with name")
   var id=problemId.substring(0,problemId.indexOf("()"));
   var useremail=problemId.substring(problemId.indexOf("()")+2);
   var solutions="";
   var scounts=0;
    user_allSolutions.find({"useremail":useremail,"pid":id}, {$sort:{time:1}},function (err2, allversion) {
      scounts=allversion.length;
      for( var u in allversion ) 
        solutions=solutions+allversion[u].solution+"&&code&&version&&^^^$#";
      user.findOne({email:useremail},function(error,student1){
        PROBLEMS.findById((id),{},function(e,problem){

            var prototype=problem.prtotype;
            var studentname="";
            var date="";

            save_problem.findOne({"useremail":useremail,"pid": id} ,function (err2, doc2) {
             if(err2==null)
                 {
                  if(doc2!==null){
                     
                      prototype=doc2.solution;
                      studentname=student1.name;
                      date="did not submit";
                }
              }
             user_problems.findOne({"useremail":useremail,"pid": id}      
        ,function (err, doc) {
            
                 if(err==null)
                 {
                  if(doc!==null & doc.submit==true){
                      prototype=doc.solution;
                      studentname=student1.name;
                      date=doc.time;
                }
              }
              console.log("solutions peoople");
             
   res.render('studentsolutionview2.ejs',{problem1:problem,title : problem.Description,result:"program result",sol:prototype,test:"",id1: id,grader:req.user,semail:useremail,studentname:studentname,date:date,solutions:solutions,classId:problem.classId,host:"http://"+req.headers.host+"/",scounts:scounts});              
  });});});});
  });
  }
  else if (problemId.indexOf("{}")>0){
    var r=problemId.substring(problemId.lastIndexOf("{}")+2);
    var id=problemId.substring(problemId.indexOf("{}")+2,problemId.lastIndexOf("{}"));
    var code1="";
    var studentname="";
    var student="";
    var classUsers=[];
   
    PROBLEMS.findById((id),{},function(e,problem){
       classinfo.findById(problem.classId,{},function(e,class1){
           coursesUsers.find({useremail:{$regex : /@brandeis.edu/},codePin:class1.classPin},{sort:{name:1}},function(e,students){
           for (var u in students){
             if (students[u].role !="adminteacher")
               classUsers.push(students[u].useremail);
           }
    user_problems.findOne({"hashtest":r,"pid": id,"useremail":{$in:classUsers}}      
    ,function (err, doc) {
             
             if(err==null)
             {
              if(doc!==null)
              {
                code1=doc.solution;
                studentname=doc.username;
                student=doc.useremail;
              }
              
            }
           
             
            res.render('studentsolutionview2.ejs', {"problem1":problem,sol:code1,problemId: id,user:req.user,classId:problem.classId,psid:problem.problemsetId,host:"http://"+req.headers.host+"/",studentname:studentname,semail:student,scounts:scounts,solutions:solutions});
       });
        });
         });
           });}
 
  else{
  var sol=""

  PROBLEMS.findById(new ObjectID(problemId),{sort: { _id: -1}},function(e,problem1){
     var sol=problem1.scafolding
     var showcases=problem1.showcases;
     var correctSolutions=[];
     var correctSolutions1=new sets.Set();
      if((problem1.classId=="587e2642b9163bcd44dae90b"==true) && (re.test(req.user.email)==false)){
         res.render("login",{message:"Error you have to login with brandeis unit id"});
      }

      else{
      user_allSolutions.find({"pid": problemId,"percentcorrect":100},function (error,allcorrectSolution){
      if(problem1.allowCorrect==true){
      for( var s in allcorrectSolution){
       correctSolutions1.add(allcorrectSolution[s].solution);
      }}
     problemset.findById(problem1.problemsetId,function(e,ps){

      
        correctSolutions=correctSolutions1.array();
     save_problem.findOne({"useremail":req.user.email,"pid": problemId}      
    ,function (err, savedversion) {
        if (err) {
            console.log(err);
            // If it failed, return error
            res.send("There was a problem ");
        }
        else {
              
              if(savedversion!=null){
                sol=savedversion.solution;
     }}  
          console.log(req.headers.host+"/");
          res.render('test.ejs', {
            "problem1" : problem1 ,reqsubmission:ps.reqsubmission,scounts:correctSolutions.length-1,correctSolutions:correctSolutions,user:req.user,problemId:problemId,sol:sol,classId:problem1.classId,psid:problem1.problemsetId,host:"http://"+req.headers.host+"/"
          });
        });
        });
     });}


});
}
});
// this to add problem  in the db

router.get('/getruntimerror/:id',function(req,res){
var id=req.params.id;
user_allSolutions.find({"pid":id,'stderr':"run time error in Testing\n"},function(e,solutions){
  for (s in solutions)
    console.log(solutions[s]);
  res.render("error");
});
});
router.post('/addproblem',isLoggedIn,isAdmin2, function(req, res) {
    // Set our internal DB variable
    var id=req.body.problemId;
    var descriptions = req.body.des;
    var pname= req.body.pname;
    var classId=req.body.classId;
    var problemsetId=req.body.problemsetId;
    var scafolding= req.body.scafolding;
    var sol=req.body.sol;
    var test_generator=req.body.test_genrator;
    var retype=req.body.reType;
    var pNumbers=req.body.pNumbers;
    var methodname=req.body.pmethod;
    var showcases=req.body.showcases;

     if( id=="undefined"){
   if (showcases.trim.length==0)
    showcases=true
    PROBLEMS.insert({
        "Description" : descriptions,
        "pname" : pname,
        "classId":classId,
        "problemsetId":problemsetId,
        "creator":req.user.email,
        "test_generator":test_generator,
        "sol":sol,
        "scafolding":scafolding,
        "retype":retype,
        "show":false,
        "pNumbers":pNumbers,
        "methodname":methodname,
        "showcases":showcases
    }, function (err, doc) {
        if (err) {
            // If it failed, return error
            res.send("There was a problem adding the information to the database.");
        }
        else {
          res.redirect("/classes/problems/"+classId+"/"+problemsetId);
        }
    });
     }
    else {
      var show;
      if(req.body.show=="true" || req.body.show==true )
        show=true;
      else
        show=false;
       console.log('showcases1')
       console.log(showcases);
       console.log('showcases2')
       console.log(req.body.showcases2)
      if(showcases!=undefined && showcases.trim().length==0)
        showcases=req.body.showcases2
      if(showcases=="true" || showcases==true || showcases=="on" )
        showcases=true;
      else
        showcases=false;
       console.log(showcases);
     PROBLEMS.findAndModify({query:{"_id":id },update:{$set:{"Description":descriptions,"pname":pname,"classId":classId,
        "problemsetId":problemsetId,
        "test_generator":test_generator,
        "sol":sol,
        "scafolding":scafolding,
        "retype":retype,
        "show":show,
        "pNumbers":pNumbers,
        "methodname":methodname,"showcases":showcases}}},function(err,doc){
      if (err)
        res.send("There was a problem modifyng the information to the database.");
    else
       res.redirect("/classes/problems/"+classId+"/"+problemsetId);

    });
    }
});

router.get('/problems/update/:classId/:problemsetId/:problemId',isLoggedIn,isAdmin,function(req,res){
    var problemId=req.params.problemId;
    var classId=req.params.classId;
    var problemsetId=req.params.problemsetId;

    PROBLEMS.findById(problemId,{},function(e,problem){
         classinfo.findById((classId),{},function(e,classinfom){
          coursesUsers.findOne({"useremail":req.user.email,"codePin":classinfom.classPin},function(e,userinfo){
            console.log("problemshowcases")
            console.log(problem.showcases)
            res.render('newproblem', {
                title : 'Edit the assignment',assignment:problem,user:req.user,problemId:problemId,classId:classId,problemsetId:problemsetId,userinfo:userinfo});
        });
    });
 });
    });

router.post("/addnewproblemSet",isLoggedIn,function (req,res,next){
  console.log(req.body.pid)
    if(req.body.pid==undefined || req.body.pid=="undefined"){
      var submission=false;
      if(req.body.reqsubmission=="on"|| req.body.reqsubmission==true || req.body.reqsubmission=="true" )
        submission=true
      problemset.insert({
                        "useremail": req.user.email,
                        "classId": req.body.classId,
                        "pname":req.body.pname,
                        "pskill":req.body.skills,
                        "pinst":req.body.inst,
                        "pduetime":req.body.duetime,
                        "codeneeded":req.body.codeneeded,
                        "pin":req.body.pin,
                        "showproblemset":true,
                        "reqsubmission":submission
                  },
             function (err2, doc2) {
            if (err2) 
            {
                // If it failed, return error
                res.send("There was a problem adding the information to the database.");
            }
            else 
               
               res.redirect("/classes/problems/"+req.body.classId);
            });}
else{
      console.log("codeneeded")
      console.log(req.body.codeneeded)
      var show=false;
      if(req.body.showproblemset=="on"||req.body.showproblemset==true ||req.body.showproblemset=="true" ||req.body.showproblemset==undefined || req.body.showproblemset=="undefined" )
       show=true;
      var code=req.body.codeneeded;
      if(code!=undefined && code.trim().length==0)
        code=req.body.accesscode;
      if(code==true || code=="true" || code=="on")
        code=true;
      else
        code=false
      var submission=req.body.reqsubmission2;
      if(req.body.reqsubmission==undefined || req.body.reqsubmission.trim().length>0  ){
        if (req.body.reqsubmission=="on"|| req.body.reqsubmission==true || req.body.reqsubmission=="true")
          submission=true;
        else
          submission=false;
       }
    
      console.log(req.body.reqsubmission2)
      problemset.update({_id:req.body.pid},{$set:{"pname":req.body.pname,
                            "pskill":req.body.skills,
                            "pinst":req.body.inst,
                            "pduetime":req.body.duetime,
                            "codeneeded":code,"pin":req.body.pin,
                            "showproblemset":show,"reqsubmission":submission}});
       res.redirect("/classes/problems/"+req.body.classId);
}
});

router.get("/updateproblemset/:classId/:psid",isLoggedIn,isAdmin,function(req,res){
  problemset.findById(req.params.psid, function (err2, ps) {
    classinfo.findById(ObjectID(req.params.classId),{},function(e,classinfom){
      coursesUsers.findOne({"useremail":req.user.email,"codePin":classinfom.classPin},function(e,userinfo){
    res.render('newproblemset',{title:'update the problem set',classId:req.params.classId,classinfom:classinfom,userinfo:userinfo,user:req.user,ps:ps});    });
    });
  });
});
router.get('/newproblemset/:classId',isLoggedIn,isAdmin,function(req,res){
     
     
    var classId=req.params.classId;
    classinfo.findById(ObjectID(classId),{},function(e,classinfom){
      coursesUsers.findOne({"useremail":req.user.email,"codePin":classinfom.classPin},function(e,userinfo){
    res.render('newproblemset',{title:'Create new problem set',classId:classId,classinfom:classinfom,userinfo:userinfo,user:req.user});    });
    });
      
   
});
router.get("/realtimegraph/:classId/:id/:k/:minR/:section",isLoggedIn,isAdmin,function(req,res){
  
  var classId=req.params.classId;
   var db=req.db;
  var minR=req.params.minR;
  var id1=req.params.id;
  var collection =db.get('userSoultionsToProblems');
  var result= {};
  var k="0";
  var section="All";
  k=req.params.k;
  section=req.params.section;
  var counthash= new Object();
  var alises = {};
  var percent=new Object();
  var completeHash=[];
  var passedTesthash=new sets.Set();
  var passedTesthash2=new sets.Set();
  var nodesName={};
  var hash_code={};
  var hash_names={};
  var hash_node={};
  var self_node={};
  var start_no=0;
  var gaveup_no=0;
  var graph = new Graph;
  var uUsers={};
  var fromCount={};
  var sectionvalue="";
  var users={};
  user.find({email: {$regex : /@brandeis.edu/},role:{$ne:"adminteacher"}},{sort:{name:1}},function(e,students){
   for (var u in students){
     users[students[u].email]=students[u].name;
   }
   var useremails=Object.keys(users);
  if ( section=="All")
  sectionvalue = {
       "pid" :id1 ,
       "hashtest"  : {$not: {$size: 0},$ne:null,$exists: true} ,"useremail":{$in:useremails}};
  else
    sectionvalue  = {
       "pid" :id1 ,
       "hashtest"  : {$not: {$size: 0},$ne:null,$exists: true },
       "section" :section,"useremail":{$in:useremails}};  
  collection.find(sectionvalue,{sort:{useremail:1,time:1}} ,function(e,hashvalues){
      if (Object.keys(hashvalues).length>0){
        var useremail1 =hashvalues[0].useremail;
        var hashvalue=hashvalues[0].hashtest.trim();
        alises[hashvalue]=Object.keys(alises).length
        // count the number of the same code was tried 
        for (var  h in hashvalues){
            if (hashvalues[h].hashtest!=null ){
              if(hashvalues[h].hashtest.trim() in uUsers==false){
                uUsers[hashvalues[h].hashtest.trim()]=new sets.Set();
              }
              uUsers[hashvalues[h].hashtest.trim()].add(hashvalues[h].useremail)
              if (hashvalues[h].hashtest.trim() in percent==false){
                if (hashvalues[h].percentcorrect!=null)
                 percent[hashvalues[h].hashtest.trim() ]=hashvalues[h].percentcorrect;
                else{
                 percent[hashvalues[h].hashtest.trim() ]=0; 
                }
              }
              if (hashvalues[h].hashtest.trim() in counthash)
                counthash[hashvalues[h].hashtest.trim() ]=counthash[hashvalues[h].hashtest.trim() ]+1;
              else
                counthash[hashvalues[h].hashtest.trim() ]=1;  
              if (hashvalues[h].testpassed==true || hashvalues[h].percentcorrect==100)
              {
                  passedTesthash.add(hashvalues[h].hashtest.trim());
                  passedTesthash2.add(hashvalues[h].hashtest.trim());
              } 
              if (hashvalues[h].hashtest.trim() in hash_code==false){ // to store the code related to one hashcode
                    hash_code[hashvalues[h].hashtest.trim()]=new sets.Set();
                    hash_names[hashvalues[h].hashtest.trim()]=new sets.Set();
                  }
                hash_code[hashvalues[h].hashtest.trim()].add(hashvalues[h].solution);
                hash_names[hashvalues[h].hashtest.trim()].add(hashvalues[h].useremail)     
        }
      }
      console.log("passed");
      console.log(passedTesthash2);
        var start="start"
        var h=0;
        var x="";
        var complete=false;
        while ( hashvalues[h+""]!==undefined)
        { 
            if (h==0)
            {
                if (uUsers[hashvalues[h+""].hashtest.trim()].size()<=k){
                  h=findnexthash(uUsers,useremail1,hashvalues,h,k); 
                }
                if(h>=0)
                {
                  if (hashvalues[h+""].hashtest.trim() in alises ==false)
                            alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
                  x="0->" + hashvalues[h+""].hashtest.trim();
                  if(x in result)
                            result[x]=result[x]+1;
                          else 
                            result[x]=1;
                  nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                }
                else 
                {
                       x="0" + "->1";
                       if(x in result)
                        result[x]=result[x]+1;
                       else 
                        result[x]=1;
                       useremail1 =hashvalues[h*(-1)+""].useremail;
                       while ( h<0 && hashvalues[(h*-1)+""]!==undefined){
                          if(x in result)
                            result[x]=result[x]+1;
                          else 
                            result[x]=1;
                          var t=h*(-1);
                          useremail1=hashvalues[t+""].useremail;
                          h=findnexthash(uUsers,useremail1,hashvalues,t,k); 
                      }
                      if (h>0 && hashvalues[h+""]!==undefined)
                      {  
                         useremail1=hashvalues[(h+"")].useremail;
                         if (hashvalues[h+""].hashtest.trim() in alises ==false)
                            alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
                         x="0->" + hashvalues[h+""].hashtest.trim();
                         nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                         if(x in result)
                            result[x]=result[x]+1;
                          else 
                            result[x]=1;
                      }
                    else 
                    { h=h*-1;
                      complete=true;
                    }
                  }
              } 
            if ( !complete )
            {
                useremail1 =hashvalues[h+ ""].useremail;
                
                if (hashvalues[h+""].hashtest.trim() in alises ==false)
                  alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
                var m=h+1;
                if (hashvalues[m+""]!== undefined ){
                    if (uUsers[hashvalues[m+""].hashtest.trim()].size()<=k)
                      m=findnexthash(uUsers,useremail1,hashvalues,m,k); 
                      if (m>0 && useremail1==hashvalues[m+ ""].useremail)
                      {
                          if(hashvalues[m+""]!== undefined)
                          {
                            //" if I am creating the steps for the same user "
                            if (hashvalues[h+""].hashtest.trim() in alises ==false)
                                alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
                            if (hashvalues[m+""].hashtest.trim() in alises ==false)
                                alises[hashvalues[m+""].hashtest.trim()]= Object.keys(alises).length
                            x=hashvalues[h+""].hashtest.trim() + "->" + hashvalues[m+""].hashtest.trim();
                            nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                            nodesName[hashvalues[m+""].hashtest.trim()]=alises[hashvalues[m+""].hashtest.trim()]+"_"+ counthash[hashvalues[m+""].hashtest.trim()] +"_" +percent[hashvalues[m+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[m+""].hashtest.trim()].size();
                            if(x in result)
                                result[x]=result[x]+1;
                            else 
                              {  result[x]=1;
                                 fromCount[x]=counthash[hashvalues[h+""].hashtest.trim()];

                              }
                            if (hashvalues[m+""].hashtest.trim()==hashvalues[h+""].hashtest.trim())
                              self_node[hashvalues[m+""].hashtest.trim()]=x;
                            if (passedTesthash.has(hashvalues[h].hashtest.trim())){
                              hash_node[hashvalues[h+""].hashtest.trim()]="\""+alises [hashvalues[h+""].hashtest.trim()] +"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size() +"\"" +"[shape=doublecircle,color=red, fontcolor=blue,fillcolor=\""+ convertRGB(1-(percent[hashvalues[h+""].hashtest.trim()]/100),(percent[hashvalues[h+""].hashtest.trim()]/100),0)+"\", style=\"filled\""
                              passedTesthash.remove(hashvalues[h+""].hashtest.trim());
                            }
                            else if (passedTesthash.has(hashvalues[m+""].hashtest.trim())){
                                    hash_node[hashvalues[m+""].hashtest.trim()]="\""+alises [hashvalues[m+""].hashtest.trim()] +"_"+ counthash[hashvalues[m+""].hashtest.trim()] +"_" +percent[hashvalues[m+""].hashtest.trim()].toFixed(0) +"%_" +uUsers[hashvalues[m+""].hashtest.trim()].size()+"\"" +"[shape=doublecircle,color=red, fillcolor=\""+ convertRGB(1-(percent[hashvalues[m+""].hashtest.trim()]/100),(percent[hashvalues[m+""].hashtest.trim()]/100),0)+"\", fontcolor=blue,style=\"filled\""
                                    passedTesthash.remove(hashvalues[m+""].hashtest.trim());
                            }
                            else
                            {
                              if(passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false )
                                hash_node[hashvalues[h+""].hashtest.trim()]="\""+alises [hashvalues[h+""].hashtest.trim()] +"_"+ counthash[hashvalues[h+""].hashtest.trim()]+"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size() +"\"[color=\""+ convertRGB(1-(percent[hashvalues[h+""].hashtest.trim()]/100),(percent[hashvalues[h+""].hashtest.trim()]/100),0)+"\", style=\"filled\" ,fontcolor=blue";
                              if (passedTesthash2.has(hashvalues[m+""].hashtest.trim())==false)
                                hash_node[hashvalues[m+""].hashtest.trim()]="\""+alises [hashvalues[m+""].hashtest.trim()] +"_"+ counthash[hashvalues[m+""].hashtest.trim()]+"_" +percent[hashvalues[m+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[m+""].hashtest.trim()].size() +"\"[color=\""+ convertRGB(1-(percent[hashvalues[m+""].hashtest.trim()]/100),(percent[hashvalues[m+""].hashtest.trim()]/100),0)+"\", style=\"filled\",fontcolor=blue";
                            }
                            h=m;  
                          }
                          else
                          {
                            if ( passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false  ) {
                              x= hashvalues[h+""].hashtest.trim() +"->1";
                              nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                              if(x in result)
                                 result[x]=result[x]+1;
                              else 
                              {  result[x]=1;
                                 fromCount[x]=counthash[hashvalues[h+""].hashtest.trim()];
                              } 
                            }
                             h=m;
                             break;
                          }  
                        }
                        else
                        {
                          if(passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false){
                            x= hashvalues[h+""].hashtest.trim()+"->1";
                            nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                           
                            if(x in result)
                                 result[x]=result[x]+1;
                            else 
                              {  result[x]=1;
                                 fromCount[x]=counthash[hashvalues[h+""].hashtest.trim()];

                              } 
                          }
                          if (m<0)
                            h=m*-1;
                          else  // in case we did not change the m but m was belong to another user
                            h=m;

                         
                          if(hashvalues[h+""]!== undefined)
                          {
                             useremail1=hashvalues[h+""].useremail;
                             if (uUsers[hashvalues[h+""].hashtest.trim()].size()<=k)
                              h=findnexthash(uUsers,useremail1,hashvalues,h,k); 
                            if (h>=0 )
                            { 
                              useremail1=hashvalues[h+""].useremail;
                               if (hashvalues[h+""].hashtest.trim() in alises ==false)
                                alises[hashvalues[h+""].hashtest.trim()]= Object.keys(alises).length
                              x="0->" +hashvalues[h+""].hashtest.trim();
                              nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                              if(x in result)
                                result[x]=result[x]+1;
                              else 
                                result[x]=1;
                            }
                            else 
                            {
                              
                              h=h*-1;
                              if(hashvalues[h+""]!== undefined)
                              {
                                  x="0->1" ;
                                  if(x in result)
                                     result[x]=result[x]+1;
                                  else 
                                     result[x]=1;
                                  useremail1=hashvalues[h+""].useremail;
                                  if (uUsers[hashvalues[h+""].hashtest.trim()].size()<=k)
                                    h=findnexthash(uUsers,useremail1,hashvalues,h,k); 
                                  while(h<0  && hashvalues[(-1*h)+""]!==undefined)
                                  {
                                    if(x in result)
                                       result[x]=result[x]+1;
                                    else 
                                       result[x]=1;
                                    var t=h*-1;
                                    useremail1=hashvalues[t+""].useremail;
                                    h=findnexthash(uUsers,useremail1,hashvalues,t,k); 
                                  }
                                  if (h>0 && hashvalues[""+h]!==undefined)
                                  {
                                    useremail1=hashvalues[h+""].useremail;
                                    if (hashvalues[h+""].hashtest.trim() in alises ==false)
                                      alises[hashvalues[h+""].hashtest.trim()]=Object.keys(alises).length
                                     x="0->" + hashvalues[h+""].hashtest.trim();
                                     nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();
                                     if(x in result)
                                        result[x]=result[x]+1;
                                     else 
                                        result[x]=1;
                                  }
                              else
                              {
                                  complete=true;
                                  break;
                              }  
                              }
                              else
                              {
                                
                                complete=true;
                                break;
                              }
                          }
                          if ( passedTesthash.has(hashvalues[h+""].hashtest.trim()))
                          {
                              hash_node[hashvalues[h+""].hashtest.trim()]="\""+alises [hashvalues[h+""].hashtest.trim()] +"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size() +"\"" +"[shape=doublecircle,color=red, fillcolor=\""+ convertRGB(1-(percent[hashvalues[h+""].hashtest.trim()]/100),(percent[hashvalues[h+""].hashtest.trim()]/100),0)+"\", fontcolor=blue,style=\"filled\""
                              passedTesthash.remove(hashvalues[h+""].hashtest.trim());
                          }
                          else 
                          {
                              if( passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false  )
                                hash_node[hashvalues[h+""].hashtest.trim()]="\""+alises [hashvalues[h].hashtest.trim()] +"_"+ counthash[hashvalues[h+""].hashtest.trim()]+"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size() +"\"[color=\""+ convertRGB(1-(percent[hashvalues[h+""].hashtest.trim()]/100),(percent[hashvalues[h+""].hashtest.trim()]/100),0)+"\", style=\"filled\",fontcolor=blue";
                          }
                          }
                      }
                    }
                   else {
                    if ( passedTesthash2.has(hashvalues[h+""].hashtest.trim())==false  ) {
                        x= hashvalues[h+""].hashtest.trim()+ "->1" ;
                        nodesName[hashvalues[h+""].hashtest.trim()]=alises[hashvalues[h+""].hashtest.trim()]+"_"+ counthash[hashvalues[h+""].hashtest.trim()] +"_" +percent[hashvalues[h+""].hashtest.trim()].toFixed(0) +"%_"+uUsers[hashvalues[h+""].hashtest.trim()].size();

                            if(x in result)
                                 result[x]=result[x]+1;
                           else 
                              {  result[x]=1;
                                 fromCount[x]=counthash[hashvalues[h+""].hashtest.trim()];

                              }
                    }
                   
                    complete=true;
                    break;
                  }
                  }
                }
          var  start_no=0;
          var gaveup_no=0;
         for (var x in result ){
            if (x.split("->")[0]=="0")
              start_no=start_no+result[x];
            if ((x.split("->")[1]).trim()=="1")
              gaveup_no=gaveup_no+result[x];
        } 
        var Problems = db.get('problems');
        Problems.findById((id1),{},function(e,problem){
          res.render("realtimegraph",{scafolding:problem.scafolding,nodesName:nodesName,alises:alises,percent:percent,counthash:counthash,start_no:start_no,gaveup_no:gaveup_no,fromCount:fromCount,result:result,self_node:self_node,id1:id1,section:section,pname:problem.pname,hash_code:hash_code,k:k,user:req.user,minR:minR,hash_names:hash_names,users:users,classId:classId});
      });
    }
    else{
      res.render('noresult',{user:req.user});
    }
});
  }); 
});

router.post('/hideShowProblems',isLoggedIn, function(req,res){
  var show2;
  if (req.body.show=="false" || req.body.show==false)
    show2=false;
  else
    show2=true;
  PROBLEMS.update({
       "_id" : req.body.pid},{$set:{"show":show2}},{upsert:true});
  res.send("");
  });


router.post('/hideShowProblemset',isLoggedIn, function(req,res){
  var show2;
  if (req.body.show=="false" || req.body.show==false)
    show2=false;
  else
    show2=true;
  problemset.update({
       "_id" : req.body.pid},{$set:{"showproblemset":show2}},{upsert:true});
  console.log("updated");
  res.send("");
  });
router.post('/allowCorrectProblems',isLoggedIn, function(req,res){
  var show2;
  if (req.body.allowCorrect=="false" || req.body.allowCorrect==false)
    show2=false;
  else
    show2=true;

  PROBLEMS.update({
       "_id" : req.body.pid},{$set:{"allowCorrect":show2}},{upsert:true});
  res.send("");

  });
function isLoggedIn(req, res, next) {
     console.log("loggedin");
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        {
         console.log("finished loggein");
        return next();
      }

   if (req.url!="http://"+req.headers.host+"/"+"saveproblem")
    // to make the user redirect to the page he wanted after log in 
    req.session.redirectUrl = req.url
    // if they aren't redirect them to the home page
    res.render('login'); // this is login page 
}
function isAdmin2(req, res, next) {
        console.log(req.body.userinfo);
        if (req.body.userinfo=="adminteacher")
            return next();
        res.redirect("error");
    
};
function isAdmin(req, res, next) {
   console.log("I am in is admin");
   console.log("class ID")
 
   var classId=req.params.classId;
   console.log(classId)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
   
    classinfo.findById(ObjectID(classId),{},function(e,classinfom){
      coursesUsers.findOne({"useremail":req.user.email,"codePin":classinfom.classPin},function(e,userinfo){
        if (userinfo.role=="adminteacher")
            return next();
        res.render("error",{message:"You do not have permission to access this page"});
      });
    });
};

module.exports = router;
