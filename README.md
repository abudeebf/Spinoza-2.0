

# Spinoza 2.0
Spinoza 2.0 is python online IDE that allow the instructor to post programming question to students and support some intrestring classroom Orchestration features.


Installing Spinoza on your machine so that it runs on localhost for testing ...

## On Mac:
Create a folder "SpinozaServer"
Install the latest version 4 release of node (12/2017) at https://nodejs.org/dist/latest-v4.x/ and unzip it into the SpinozaServer Folder
Visit https://github.com/abudeebf/Spinoza-2.0  and unzip to the SpinozaServer folder
Open the terminal and cd to the SpinozaServer folder and then into Spinoza-2.0-master
Start the server with
../node*/bin/npm start
Visit http://localhost:3004 

## On windows:
Create a folder "SpinozaServer"
Install winrar https://windows10portal.com/download-winrar/
Install the latest version 4 release of node (12/2017) at https://nodejs.org/dist/latest-v4.x/ and unzip it into the SpinozaServer Folder
Visit https://github.com/abudeebf/Spinoza-2.0  and unzip with winrar or 7z to the SpinozaServer folder
Open the terminal and cd to the SpinozaServer folder and then into Spinoza-2.0-master
Start the server with
../node*/npm start
or
cmd /c 'C:\fullpath to the node-r.8.7-win-x64\npm.cmd'   start
If the first doesn't work...
Visit http://localhost:3004 

## Setting up the server to run for your students
* start Spinoza-2.0 on a dedicated server (perhaps using screen or forever or pm2)
* visit console.developer.google.com and setup Oauth2 credentials ... (EXPLAIN)




To use your own database 
you need to install mongodb and change the DB specification in routes/config.js EXPLANATION
Installing Mongodb
1. Visit mongodb page and download the community version
https://www.mongodb.com/download-center?_ga=2.239992771.1356982267.1516133500-1351028849.1516133500&_gac=1.6473478.1516133500.EAIaIQobChMI-M2InaTd2AIVSDaBCh0zwwQLEAAYASAAEgJ0IPD_BwE#community
2. Unzip and follow directions ..
Setting up authentication on your local copy of mongodb

Start the mongodb in a separate window
% mongod --port 3009 --dbpath/ localdata

Then set up authentication:
% mongo --port 3009
use spinozaDBPython
db.createUser(
    {user:"spinoza", 
     pwd:"spinoza123", 
     roles:[ {role:"readWrite", db:"spinozaDBPython"}]
    }
)

Then restart the mongo database with
mongod --dbpath localdata --port 3009 --auth 
Then connect to mongo with username and password to test it
% mongo spinozaDBPython --port 3009 -u USERNAME -p PASSWORD
> show collections
.....








