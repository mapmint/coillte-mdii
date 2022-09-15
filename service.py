# -*- coding: utf-8 -*-
###############################################################################
#  Author:   Gérald Fenoy, gerald.fenoy@geolabs.fr
#
#  Copyright (c) 2019 Coillte Teoranta. All rights reserved.
#
#  This work has been supported by Coillte Teoranta, Forest Resource Planning
############################################################################### 
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
# 
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
# 
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
################################################################################
import zoo
import sys
from imaplib import IMAP4 as IMAP
import imaplib
import base64
import os
import email
import json

def sendmail0(conf,inputs,outputs):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders
    import authenticate.service as auth
    con=auth.getCon(conf)
    cur=con.conn.cursor()
    server=smtplib.SMTP(host='localhost',port=25)
    if "attachment" in inputs:
        msg = MIMEMultipart()
        msg['From'] = "cmdii@coillte.mapmint.com"
        msg['To'] = inputs["mailTo"]["value"]
        if inputs["validity"]["value"]=="false":
            msg['Subject'] = "MapMint Server: your MDII ZIP file was rejected"
            if "comment" not in inputs or inputs["comment"]["value"]=="":
                msg.attach(MIMEText("Your MDII Zip file was rejected during the validation.\n", 'plain'))
            else:
                msg.attach(MIMEText("Your MDII Zip file was rejected during the validation. Please see the reason below:\n"+inputs["comment"]["value"]+"\n", 'plain'))
        else:
            msg['Subject'] = "MapMint Server: a new FDC Post Thin Zip file was approved"
            if "comment" in inputs and inputs["comment"]["value"]!="":
                msg.attach(MIMEText("Inventory staff has approved FDC Post Thin Estimates. Please update Subcompartment estimates in the database.:+\n"+inputs["comment"]["value"]+"\n", 'plain'))
            else:
                msg.attach(MIMEText("Inventory staff has approved FDC Post Thin Estimates.\n", 'plain'))
        with open(inputs["attachment"]["cache_file"], 'rb') as filep:
            msg0 = MIMEBase('application', "octet-stream")
            msg0.set_payload(filep.read())
            encoders.encode_base64(msg0)
            msg0.add_header('Content-Disposition', 'attachment', filename=os.path.basename(inputs["attachment"]["cache_file"]))
            msg.attach(msg0)
        server.sendmail(msg['From'], msg['To'], msg.as_string())
    server.quit()
    outputs["Result"]["value"]="Mail sent!"
    return zoo.SERVICE_SUCCEEDED

def sendmail(conf,inputs,outputs):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    import authenticate.service as auth
    con=auth.getCon(conf)
    cur=con.conn.cursor()
    req="SELECT mail from mm.users, mm.user_group, mm.groups where mm.users.id=id_user and  mm.groups.id=id_group and name = $q$"+conf["mm_mail"]["group"]+"$q$"
    cur.execute(req)
    val=cur.fetchall()
    server=smtplib.SMTP(host='localhost',port=25)
    f=open(conf["mm_mail"]["path"]+"/msg_content.txt","r")
    for i in range(len(val)):
        msg = MIMEMultipart()
        msg['From'] = "cmdii@coillte.mapmint.com"
        msg['To'] = val[i][0]
        msg['Subject'] = "ZIP uploaded"
        message=f.read().replace("[USER]",inputs["name"]["value"])
        msg.attach(MIMEText(message, 'plain'))
        server.sendmail(msg['From'], msg['To'], msg.as_string())
    server.quit()
    outputs["Result"]["value"]="Mail sent!"
    return zoo.SERVICE_SUCCEEDED

def getLastEmails(conf,inputs,outputs):
    conn=IMAP(conf["mm_mail"]["server"])
    conn.login(conf["mm_mail"]["user"],conf["mm_mail"]["password"])
    status, data0 = conn.select("INBOX")
    results=[]
    for num in range(1,int(data0[0])+1):
        typ, data = conn.fetch(str(num), '(RFC822)' )
        raw_email = data[0][1]
        print(typ,file=sys.stderr)
        raw_email_string = raw_email.decode('utf-8')
        email_message = email.message_from_string(raw_email_string)
        email_from = email_message['from']
        for part in email_message.walk():
            print(part.get_content_maintype(),file=sys.stderr)
            if part.get_content_maintype() == 'multipart':
                continue
            if part.get('Content-Disposition') is None:
                continue
            print(dir(part),file=sys.stderr)
            fileName = part.get_filename()
            print(fileName,file=sys.stderr)
            print(bool(fileName),file=sys.stderr)
            if bool(fileName):
                filePath = os.path.join(conf["main"]["tmpPath"], fileName)
                oFilePath = filePath
                if not os.path.isfile(filePath) :
                    fp = open(filePath, 'wb')
                    fp.write(part.get_payload(decode=True))
                    fp.close()
                else:
                    filePath = checkFileAndcreateNew(conf,fileName,part.get_payload(decode=True))
                try:
                    tmp=email_from.split("<")
                    tmp=tmp[1].replace(">","")
                    email_from=tmp
                except:
                    print("no need to parse mail",file=sys.stderr)
                print("filePath",file=sys.stderr)
                print(filePath,file=sys.stderr)
                print("/filePath",file=sys.stderr)

                if filePath is not None:
                    results+=[{"mail": email_from, "path": filePath,"opath":oFilePath}]
        conn.store(str(num), '+FLAGS', '\\Deleted')
    conn.expunge()
    conn.close()
    conn.logout()
    outputs["Result"]["value"]=json.dumps(results)
    return zoo.SERVICE_SUCCEEDED


def md5(fname):
    import hashlib
    hash_md5 = hashlib.md5()
    with open(fname, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

import glob
def checkFileAndcreateNew(conf,filename,content):
    filePath = os.path.join(conf["main"]["tmpPath"],conf["lenv"]["usid"]+"_"+filename)
    fp = open(filePath, 'wb')
    fp.write(content)
    fp.close()
    filePath1 = os.path.join(conf["main"]["tmpPath"], filename)
    print(filePath+" "+filePath1,file=sys.stderr)
    print(md5(filePath)+" "+md5(filePath1),file=sys.stderr)
    print(md5(filePath)!=md5(filePath1),file=sys.stderr)
    if md5(filePath)!=md5(filePath1):
        cnt=0
        for name in glob.glob(os.path.join(conf["main"]["tmpPath"],"*"+filename.replace(".zip","")+"*.zip")):
            cnt+=1
        filePath = os.path.join(conf["main"]["tmpPath"],filename.replace(".zip","_"+str(cnt)+".zip"))
        fp = open(filePath, 'wb')
        fp.write(content)
        fp.close()
        return filePath
    else:
        return None

def fixName(conf,inputs,outputs):
    import re
    r=re.compile("_[0-9]."+inputs["ext"]["value"])
    res=inputs["path"]["value"]
    try:
        r.search(res).group()
        res=res.replace(r.search(res).group(),"."+inputs["ext"]["value"])
    except:
        print("No need for renaming",file=sys.stderr)
    outputs["Result"]["value"]=res
    return zoo.SERVICE_SUCCEEDED
