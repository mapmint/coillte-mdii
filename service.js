/**
 * Author : Gérald Fenoy, gerald.fenoy@geolabs.fr
 *
 * Copyright 2019 Coillte Teoranta. All rights reserved.
 * This work has been supported by Coillte Teoranta, Forest Resource Planning
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

function mailCheck(conf,inputs,outputs){
    var inputs00={
	"a": {"dataType":"string", "type":"literal", "value": "toto"}
    }
    var myOutputs00= {Result: { type: 'RawDataOutput', "mimeType": "application/json" }};
    var myProcess00 = new ZOO.Process(conf["main"]["serverAddress"],'cmd2.getLastEmails');
    var myExecuteResult00=myProcess00.Execute(inputs00,myOutputs00);
    alert(myExecuteResult00);
    try{
	var jsonObject=eval(myExecuteResult00);
	if(jsonObject.length==0){
	    conf["lenv"]["message"]="No mail found in INBOX";
	    return {result: ZOO.SERVICE_FAILED, conf: conf};
	}   
	//writeEmail to admin to inform them about the new data publication
	for(var i=0;i<jsonObject.length;i++){
	    alert(jsonObject[i]["mail"]);
	    alert(jsonObject[i]["path"]);
	    var inputs00={
		"zip": {"mimeType":"application/zip", "type":"reference", "value": "file://"+jsonObject[i]["path"]}
	    }
	    var myOutputs00= {Result: { type: 'RawDataOutput', "mimeType": "application/json" }};
	    var myProcess00 = new ZOO.Process(conf["main"]["serverAddress"],'cmd2.publishZipFiles');
	    var myExecuteResult00=myProcess00.Execute(inputs00,myOutputs00);
	    alert(myExecuteResult00);
	    outputs["Result"]["value"]=myExecuteResult00;

	    var inputs01={
		"name": {"dataType":"string", "type":"literal", "value": jsonObject[i]["mail"]}
	    }
	    var myOutputs01= {Result: { type: 'RawDataOutput', "mimeType": "text/plain" }};
	    var myProcess01 = new ZOO.Process(conf["main"]["serverAddress"],'cmd2.sendmail');
	    var myExecuteResult01=myProcess01.Execute(inputs01,myOutputs01);
	    alert(myExecuteResult01);   
	}
	// Refresh all layers extents that depend on dbuserName 
	var inputs01={
	    "type": {"dataType":"string", "type":"literal", "value": "postgis"},
	    "dsName": {"dataType":"string", "type":"literal", "value": conf["main"]["dbuserName"]}
	};
	var myOutputs01= {Result: { type: 'RawDataOutput', "mimeType": "text/plain" }};
	var myProcess01 = new ZOO.Process(conf["main"]["serverAddress"],'datastores.directories.cleanup');
	var myExecuteResult01=myProcess01.Execute(inputs01,myOutputs01);
	alert(myExecuteResult01);
	var inputs01={
	    "dataStore": {"dataType":"string", "type":"literal", "value": conf["main"]["dbuserName"]}
	}
	var myOutputs01= {Result: { type: 'RawDataOutput', "mimeType": "text/xml" }};
	var myProcess01 = new ZOO.Process(conf["main"]["serverAddress"],'datastores.mmVectorInfo2MapJs');
	var myExecuteResult01=myProcess01.Execute(inputs01,myOutputs01);
	alert(myExecuteResult01);

	var inputs01={
	    "table": {"dataType":"string", "type":"literal", "value": "mii.plotestimates"}
	}
	var myOutputs01= {Result: { type: 'RawDataOutput', "mimeType": "application/json" }};
	var myProcess01 = new ZOO.Process(conf["main"]["serverAddress"],'mapfile.updateAllExtentForMainDB');
	var myExecuteResult01=myProcess01.Execute(inputs01,myOutputs01);
	alert(myExecuteResult01);

    }catch(e){
	conf["lenv"]["message"]="Error occured "+e;
	return {result: ZOO.SERVICE_FAILED, conf: conf};
    }
    return {result: ZOO.SERVICE_SUCCEEDED, conf: conf, outputs: outputs};
}

/*

 * reinit db SQLITE

 drop table comsubEstimates;
 drop table plotEstimates;
 drop table plotLocation;
 drop table fieldmeasurements;
 drop table plot_locations; 
 CREATE TABLE 'plot_locations' (  FID INTEGER AUTOINCREMENET PRIMARY KEY, ROWID INTEGER, OGC_FID INTEGER,  'GEOMETRY' BLOB , 'name' VARCHAR, 'description' VARCHAR, 'ogr_geometry' VARCHAR);

 * reinit db PG

 drop table mdii.plot_locations;
 create table mdii.plot_locations (mmid serial, ogc_fid int4, rowid int4, name text not null, description text);
 select AddGeometryColumn ('mdii','plot_locations','wkb_geometry',4326,'POINT',2, false);
 drop table mdii.plotEstimates;
 CREATE TABLE mdii.plotEstimates (id int4, HU_ID text,Comp_sub text, Plotname text, Speciesname text, m_dbh float, max_dbh float, min_dbh float, n_stems int4, stemsha int4, basalha int4 );
 select AddGeometryColumn ('mdii','plotestimates','wkb_geometry',4326,'POINT',2, false);
 drop table mdii.comsubEstimates;
 CREATE TABLE mdii.comsubEstimates (id int4, HU_ID text,Comp_sub text, Speciesname text, m_dbh float, m_stemsha int4, m_basalha float);
select AddGeometryColumn ('mdii','comsubestimates','wkb_geometry',4326,'POLYGON',2, false);

*/
function publishZipFiles(conf,inputs,outputs){
    var schema="mii";
    var produced_dirs=[];
    if(!inputs["zip"]["length"])
	inputs["zip"]["length"]=1;
    for(var i=0;i<inputs["zip"]["length"];i++){
	var cFile;
	if(i==0){
	    cFile=inputs["zip"]["cache_file"];
	    alert(i+" "+inputs["zip"]["cache_file"]);
	}
	else{
	    cFile=inputs["zip"]["cache_file_"+i];
	    alert(i+" "+inputs["zip"]["cache_file_"+i]);
	}
	var inputs00={
	    "zip": {"mimeType":"application/zip", "type":"reference", "value": "file://"+cFile}
	}
	var myOutputs00= {Result: { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess00 = new ZOO.Process(conf["main"]["serverAddress"],'np.unzip');
	var myExecuteResult00=myProcess00.Execute(inputs00,myOutputs00);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	alert(myExecuteResult00);
	produced_dirs.push(myExecuteResult00);
	alert(myExecuteResult00+"/"+cFile.replace(/\/var\/www\/html\//g,"").replace(/.zip/g,".xls"));
	var xlsFile=myExecuteResult00+"/"+cFile.replace(/\/var\/www\/html\/tmp/g,"").replace(/.zip/g,".xls").replace(/2.2/g,"2_2").replace(/-/g,"_");
	var kmlFile=myExecuteResult00+"/"+cFile.replace(/\/var\/www\/html\/tmp/g,"").replace(/.zip/g,".kml").replace(/2.2/g,"2_2").replace(/-/g,"_");
	var inputs01={
	    "db": {"dataType":"string", "type":"literal", "value": conf["main"]["tmpPath"]+"/postThin"+/**/conf["lenv"]["usid"]+"_"+i+/**/".db"},
	    "data": {"mimeType":"application/zip", "type":"reference", "value": "file://"+xlsFile }
	}
	var myOutputs01= {Result: { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess01 = new ZOO.Process(conf["main"]["serverAddress"],'cmd2.analyze');
	var myExecuteResult01=myProcess01.Execute(inputs01,myOutputs01);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	alert(myExecuteResult01);

	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "append": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "SQLite"},
	    "nln": {"dataType":"string", "type":"literal", "value": "plot_locations"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": "postThin"/**/+conf["lenv"]["usid"]+"_"+i/**/+".db"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": kmlFile}/*,
	    "t_srs": {"dataType":"string", "type":"literal", "value": "epsg:4326"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": "SELECT \"Name\",\"Description\" from \"Layer #0\""}*/
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
	var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	alert(myExecuteResult02);

	var dbUser=conf[conf["main"]["dbuserName"]];
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "append": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "PostgreSQL"},
	    "nln": {"dataType":"string", "type":"literal", "value": schema+".plot_locations"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": conf["main"]["tmpPath"]+"/postThin"/**/+conf["lenv"]["usid"]+"_"+i/**/+".db"},/*
	    "t_srs": {"dataType":"string", "type":"literal", "value": "epsg:4326"},*/
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": "SELECT * from plot_locations"}
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
	var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	alert(myExecuteResult02);

	var _tables=["plotestimates","comsubestimates"];
	for(var j=0;j<_tables.length;j++){
	    var inputs02={
		"skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
		"append": {"dataType":"string", "type":"literal", "value": "true"},
		"f": {"dataType":"string", "type":"literal", "value": "PostgreSQL"},
		"nln": {"dataType":"string", "type":"literal", "value": schema+"."+_tables[j]},
		"lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
		"OutputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
		"InputDSN": {"dataType":"string", "type":"literal", "value": conf["main"]["tmpPath"]+"/postThin"/**/+conf["lenv"]["usid"]+"_"+i/**/+".db"},
		"sql": {"mimeType":"text/plain", "type":"complex", "value": 'SELECT * from '+_tables[j]+''}
	    }
	    var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	    var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
	    var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	    alert(myExecuteResult02);
	}
	
    }
    return {result: ZOO.SERVICE_SUCCEEDED, conf: conf, outputs: {Result: {"value": "Data successfully published"}}};
}
