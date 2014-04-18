Dynamoo
===
 (C) Neal Hardesty 2013

 A brain damaged AWS Route 53 Updater
  Finds the external ip, and applies the current hostname to the domains specified
 
Node modules:
```npm install aws-sdk underscore request moment```
 
Requires a config file named .dynamoo.config.json in home that looks something like:
```javascript
{
"accessKeyId": "XXXX", 
"secretAccessKey": "YYYY", 
"region": "us-west-2",
"domains": "domain1.com,domain2.net",
"extrahosts": "www,git"
}
```


Note that "extrahosts" is optional (you will always have the local hostname to update).  

Whitespace is the devil in these key values.
