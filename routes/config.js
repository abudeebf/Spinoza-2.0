var config = {
development: {
    //url to be used in link generation
    url: 'yoursite',
    //mongodb connection settings
    database: {
        host:   ' ip address of host storing the db',
        port:   'your poart',
        db:     'database name',
        password:"yourdatabasepassowrd",
        username:"yourdatabaseuser"
    },
   
    //server details
    server: {
        host: 'ip address of the host running node.js',
        port: 'the port you are runnning the app from '
    },
    google:{
        clientId:'developerapi clientId',
        Secret:"developerapi secret code"

    },
  nodeMailer:{
    from:"instructor email",
    CC:"TA email",
    RefereshToken:"nodemailer referesh token"
  }
},
production: {
    //url to be used in link generation
    url: 'http://my.site.com',
    //mongodb connection settings
    database: {
        host: '129.64.46.171',
        port: '27017',
        db:     'site'
    },
    //server details
    server: {
        host:   '127.0.0.1',
        port:   '3421'
    }
}
};
module.exports = config;
