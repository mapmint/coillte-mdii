# coillte-mdii
MapMint services used to import data coming from a [Haglof MD-II callipers](<F12> http://www.haglofsweden.com/index.php/en/products/instruments/calipers/473-md-ii-caliper) used to record forest inventory data. This services processes the zip file that is generated from the calliper's associated Android app. 

Setup
===========

Clone this repository then copy the directory as ```cmd2``` in your MapMint Services location (tradionaly in ```/usr/lib/cgi-bin/mm``` on a GNU/Linux host).

```
git clone https://github.com/mapmint/coillte-mdii.git cmd2
sudo cp -r cmd2 /usr/lib/cgi-bin/mm/
```

Edit your ```main.cfg``` file located with your MapMint Services to add the following section:

```
[mm_mail]
server=your.mailserver.net
user=userName
password=userPassword
group=mapmint-group
path=/usr/lib/cgi-bin/mm/cmd2/
```

The three first parameters are used to define the IMAP4 server where ```server``` is the host to connect to, and ```user``` and ```password``` are the informations used to authentify to the IMAP4 server.

The ```group``` parameter is used to define to who should be send an email notifying for the availability of the new data, the value should be a MapMint group with members, in other case no mail will be sent.

The ```path``` parameter is used to define where the ZOO-Kernel can find the message_content.txt file used as a template to send email to the MapMint group defined previously (```group```).

How-to use
===========

The main service is the mailCheck service, it is responsible to:
1. fetch all received emails that have a zip file attached (by invoking the getLastEmails service) and publish the corresponding zip file and inform that the zip file from the user has been properly imported (by invoking publishZipFiles service)
3. refresh the datastore used as MapMint database (by invoking datastores.directories.cleanup then datastores.mmVectorInfo2MapJs service)
4. then, update the extent of every layer that depends on this datastore (by invoking the mapfile.updateAllExtentForMainDB service)

To invoke the mailCheck service simply use the following URL by replacing <YOUR_HOST> with the hostname used to access your MapMint instance:

https://<YOUR_HOST>/cgi-bin/mm/zoo_loader.cgi?request=Execute&service=WPS&version=1.0.0&Identifier=cmd2.mailCheck&DataInputs=a=toto


Troubleshooting 
================

In case you face any issue during import of your data. Then, you can manually try to load the zip files that has been extracted from the emails received by invoking the .

https://<YOUR_HOST>/cgi-bin/mm/zoo_loader.cgi?request=Execute&service=WPS&version=1.0.0&Identifier=cmd2.publishZipFiles&DataInputs=zip=Reference@xlink:href=file:///YOUR_FILENAME_PATH.zip

Before invoking the previous URL, we invite you to run the following command: ```tail -f /var/log/apache/error.log -n0 > log``` and press ```CTRL+c``` when your cmd2.publishZipFile service execution end. Then read the log file created, if anything wrong occur you should have more informations from this log file.
