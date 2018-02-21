

# Spinoza 2.0
Spinoza 2.0 is python online IDE that allow the instructor to post programming question to students and support some intrestring classroom Orchestration features.


Installing Spinoza on your machine so that it runs on localhost for testing ...

## On Mac:
1. Create a folder "SpinozaServer"
2. Install the latest version 4 release of node (12/2017) at https://nodejs.org/dist/latest-v4.x/ and unzip it into the SpinozaServer Folder
3. Visit https://github.com/abudeebf/Spinoza-2.0  and unzip to the SpinozaServer folder
4. Open the terminal and cd to the SpinozaServer folder and then into Spinoza-2.0-master
5. Start the server with ../node*/bin/npm start
6. Visit http://localhost:3004 

## On windows:
1. Create a folder "SpinozaServer"
2. Install winrar https://windows10portal.com/download-winrar/
3. Install the latest version 4 release of node (12/2017) at https://nodejs.org/dist/latest-v4.x/ and unzip it into the SpinozaServer Folder
4. Visit https://github.com/abudeebf/Spinoza-2.0  and unzip with winrar or 7z to the SpinozaServer folder
5. Open the terminal and cd to the SpinozaServer folder and then into Spinoza-2.0-master
6. Start the server with ../node*/npm start
 or
cmd /c 'C:\fullpath to the node-r.8.7-win-x64\npm.cmd'   start
If the first doesn't work...
Visit http://localhost:3004 

## Setting up the server to run for your students
You may have to talk with your System Administrator to open up the ports for the Spinoza server and the MongoDB server. We use ports 3004 and 3009, but you can use any ones you choose.
* start Spinoza-2.0 on a dedicated server (perhaps using screen or forever or pm2)
 forever ../node*/npm start
 or
 pm2 ../node*/npm start
* visit console.developer.google.com and setup Oauth2 credentials where localhost:3004 is replaced with your domain:port 
  * Authorized Javascript origins: http://localhost:3004
  * Authorized redirect URIs: http://localhost:3004/auth/google/callback
* copy the clientID and clientSecret into the appropriates fields in routes/config.js 




## To use your own database 
you need to install mongodb and change the DB specification in routes/config.js with your own host and database infromation
### Installing Mongodb
1. Visit mongodb page and download the community version

https://www.mongodb.com/download-center?_ga=2.239992771.1356982267.1516133500-1351028849.1516133500&_gac=1.6473478.1516133500.EAIaIQobChMI-M2InaTd2AIVSDaBCh0zwwQLEAAYASAAEgJ0IPD_BwE#community

2. Unzip and follow directions for installing
## Setting up authentication on your local copy of mongodb

1. Start the mongodb in a separate window
% mongod --port 3009 --dbpath/ localdata

2. Then set up authentication:
% mongo --port 3009
use spinozaDBPython
db.createUser(
    {user:"spinoza", 
     pwd:"spinoza123", 
     roles:[ {role:"readWrite", db:"spinozaDBPython"}]
    }
)

3. Then restart the mongo database with
 mongod --dbpath localdata --port 3009 --auth 
4. Then connect to mongo with username and password to test it
 % mongo spinozaDBPython --port 3009 -u USERNAME -p PASSWORD
 > show collections
** If you are able to coneect without errors you are all set!!








