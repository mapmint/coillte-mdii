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

def sendmail(conf,inputs,outputs):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    import authenticate.service as auth
    con=auth.getCon(conf)
    cur=con.conn.cursor()
    req="SELECT mail from mm.users, mm.user_group, mm.groups where mm.users.id=id_user and  mm.groups.id=id_group and name = $q$"+conf["mm_mail"]["group"]+"$q$"
    cur.execute(req)
    val=cur.fetch_all()
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
    status, data = conn.select("INBOX")
    results=[]
    for num in range(1,int(data[0])+1):
        typ, data = conn.fetch(num, '(RFC822)' )
        raw_email = data[0][1]
        raw_email_string = raw_email.decode('utf-8')
        email_message = email.message_from_string(raw_email_string)
        email_from = email_message['from']
        for part in email_message.walk():
            if part.get_content_maintype() == 'multipart':
                continue
            if part.get('Content-Disposition') is None:
                continue
            fileName = part.get_filename()
            if bool(fileName):
                filePath = os.path.join(conf["main"]["tmpPath"], fileName)
                if not os.path.isfile(filePath) :
                    fp = open(filePath, 'wb')
                    fp.write(part.get_payload(decode=True))
                    fp.close()
                results+=[{"mail": email_from, "path": filePath}]
        conn.store(num, '+FLAGS', '\\Deleted')
    conn.expunge()
    conn.close()
    conn.logout()
    outputs["Result"]["value"]=json.dumps(results)
    return zoo.SERVICE_SUCCEEDED
