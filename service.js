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

var localModulePath="cmd2";

function mailCheck(conf,inputs,outputs){
    var inputs00={
	"a": {"dataType":"string", "type":"literal", "value": "toto"}
    }
    var myOutputs00= {Result: { type: 'RawDataOutput', "mimeType": "application/json" }};
    var myProcess00 = new ZOO.Process(conf["main"]["serverAddress"],localModulePath+'.getLastEmails');
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
		"ozip": {"mimeType":"application/zip", "type":"reference", "value": "file://"+jsonObject[i]["opath"]},
		"zip": {"mimeType":"application/zip", "type":"reference", "value": "file://"+jsonObject[i]["path"]},
		"mail": {"dataType":"string", "value":jsonObject[i]["mail"] }
	    }
	    var myOutputs00= {Result: { type: 'RawDataOutput', "mimeType": "application/json" }};
	    var myProcess00 = new ZOO.Process(conf["main"]["serverAddress"],localModulePath+'.publishZipFiles');
	    var myExecuteResult00=myProcess00.Execute(inputs00,myOutputs00);
	    alert(myExecuteResult00);
	    outputs["Result"]["value"]=myExecuteResult00;

	    var inputs01={
		"name": {"dataType":"string", "type":"literal", "value": jsonObject[i]["mail"]}
	    }
	    var myOutputs01= {Result: { type: 'RawDataOutput', "mimeType": "text/plain" }};
	    var myProcess01 = new ZOO.Process(conf["main"]["serverAddress"],localModulePath+'.sendmail');
	    var myExecuteResult01=myProcess01.Execute(inputs01,myOutputs01);
	    alert(myExecuteResult01);   
	}
	// Refresh all layers extents that depend on dbuserName 
	var inputs01={
	    "type": {"dataType":"string", "type":"literal", "value": "postgis"},
	    "dsType": {"dataType":"string", "type":"literal", "value": "postgis"},
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
    var schema="cmdii_tmp";
    var schemaf="cmdii";
    var produced_dirs=[];
    var dbUser=conf[conf["main"]["dbuserName"]];
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
        var sqlQuery="INSERT INTO "+schemaf+".zip_files (name,mail) VALUES ('"+cFile+"','"+inputs["mail"]["value"]+"') RETURNING id;" ;
        var myOutputs= {"Result":{  type: 'RawDataOutput', "mimeType": "application/json" }};
    	var myInputs={
        	"dsoName": {"value": "","type":"string"},
        	"dstName": {"value": "PG:dbname="+conf["mmdb"]["dbname"]+" port="+conf["mmdb"]["port"]+" host="+conf["mmdb"]["host"]+" user="+conf["mmdb"]["user"]+(conf["mmdb"]["password"]?" password="+conf["mmdb"]["password"]:""),"type":"string"},
        	"q": {"value": sqlQuery,"mimeType":"application/json"},
    	};
	var myProcess = new ZOO.Process(conf["main"]["serverAddress"],'vector-tools.vectInfo');
	var myExecuteResult=myProcess.Execute(myInputs,myOutputs);
	alert(myExecuteResult);
	var currentId=eval(myExecuteResult);
	currentId=currentId[0]["id"];
	var inputs00={
	    "zip": {"mimeType":"application/zip", "type":"reference", "value": "file://"+cFile}
	}
	var myOutputs00= {Result: { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess00 = new ZOO.Process(conf["main"]["serverAddress"],'np.unzip');
	var myExecuteResult00=myProcess00.Execute(inputs00,myOutputs00);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	alert(myExecuteResult00);
	produced_dirs.push(myExecuteResult00);
	alert(myExecuteResult00+"/"+cFile.replace(/\/var\/www\/html\//g,"").replace(/.zip/g,".xls"));
	cFile=inputs["ozip"]["cache_file"];
        var myInputs01={
		"path": {"value":  myExecuteResult00+"/"+cFile.replace(/\/var\/www\/html\/tmp/g,"").replace(/\./g,"_").replace(/_zip/g,".xls").replace(/-/g,"_"), "type": "string" },
		"ext": {"value": "xls", "type": "string" }
	};
        var myOutputs01= {Result: { type: 'RawDataOutput', "mimeType": "plain/text" }};
        var myProcess01 = new ZOO.Process(conf["main"]["serverAddress"],localModulePath+'.fixName');
        var myExecuteResult01=myProcess01.Execute(myInputs01,myOutputs01);
        alert("******************************",myExecuteResult01,"***********************************");
	var xlsFile=myExecuteResult01;//myExecuteResult00+"/"+cFile.replace(/\/var\/www\/html\/tmp/g,"").replace(/\./g,"_").replace(/_zip/g,".xls").replace(/-/g,"_");
	var kmlFile=myExecuteResult01.replace(/xls/g,"kml")//myExecuteResult00+"/"+cFile.replace(/\/var\/www\/html\/tmp/g,"").replace(/\./g,"_").replace(/_zip/g,".kml").replace(/-/g,"_");
        /**
         * Import kml file in PG database to set proper comb_sub value
         */
	    var inputs02={
		"skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
		"append": {"dataType":"string", "type":"literal", "value": "true"},
		"f": {"dataType":"string", "type":"literal", "value": "PostgreSQL"},
		"nln": {"dataType":"string", "type":"literal", "value": schema+".kml_"+conf["lenv"]["usid"]},
		//"lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
		"OutputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
		"InputDSN": {"dataType":"string", "type":"literal", "value": kmlFile}
	    }
	    var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	    var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
	    var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	    alert(myExecuteResult02);
        /**
         *  Create a table with correct relationship defined between plot name and comb-sub
         */
	    var inputs02={
		"skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
		//"update": {"dataType":"string", "type":"literal", "value": "true"},
		"f": {"dataType":"string", "type":"literal", "value": "SQLite"},
		"nln": {"dataType":"string", "type":"literal", "value": "kml_origin"},
		//"lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
		"InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
		"OutputDSN": {"dataType":"string", "type":"literal", "value": "postThin"+/**/conf["lenv"]["usid"]+"_"+i+/**/".db"},
                "sql": {"mimeType":"text/plain", "type":"complex", "value": "SELECT *,"+currentId+" as zid,(select compartmen||''||subid as cuid from cmdii.scdb where ST_Intersects("+schema+".kml_"+(conf["lenv"]["usid"].replace(/-/g,"_"))+".wkb_geometry,cmdii.scdb.wkb_geometry)) as com_sub_real from "+schema+".kml_"+(conf["lenv"]["usid"].replace(/-/g,"_"))}
	    }
	    var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	    var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
	    var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	    alert(myExecuteResult02);
        /**
         * Invoke R Service
         */
	var inputs01={
	    "db": {"dataType":"string", "type":"literal", "value": conf["main"]["tmpPath"]+"/postThin"+/**/conf["lenv"]["usid"]+"_"+i+/**/".db"},
	    "data": {"mimeType":"application/zip", "type":"reference", "value": "file://"+xlsFile }
	}
	var myOutputs01= {Result: { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess01 = new ZOO.Process(conf["main"]["serverAddress"],localModulePath+'.analyze');
	var myExecuteResult01=myProcess01.Execute(inputs01,myOutputs01);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	alert(localModulePath+".analyze "+myExecuteResult01);
        if(myExecuteResult01.indexOf("Exception")>=0){
           data = myExecuteResult01.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/, "");
           data = new XML(data);
           alert(data);
           conf["lenv"]["message"]=data.*::Exception.*::ExceptionText[0];
           return {result: ZOO.SERVICE_FAILED, conf: conf, outputs: {Result: {"value": "Data successfully published"}}};;
	}

	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "append": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "SQLite"},
	    "nln": {"dataType":"string", "type":"literal", "value": "plot_locations"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": "postThin"/**/+conf["lenv"]["usid"]+"_0"+i/**/+".db"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": kmlFile}/*,
	    "t_srs": {"dataType":"string", "type":"literal", "value": "epsg:4326"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": "SELECT \"Name\",\"Description\" from \"Layer #0\""}*/
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
	var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	alert(myExecuteResult02);

	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "append": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "PostgreSQL"},
	    "nln": {"dataType":"string", "type":"literal", "value": schema+".plot_locations"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": conf["main"]["tmpPath"]+"/postThin"/**/+conf["lenv"]["usid"]+"_0"+i/**/+".db"},/*
	    "t_srs": {"dataType":"string", "type":"literal", "value": "epsg:4326"},*/
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": "SELECT *,"+currentId+" as zid from plot_locations"}
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
		"sql": {"mimeType":"text/plain", "type":"complex", "value": 'SELECT *,'+currentId+' as zid  from '+_tables[j]+''}
	    }
	    var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	    var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
	    var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);//,"Cookie: MMID="+conf["senv"]["MMID"]);
	    alert(myExecuteResult02);
	}

	var fields=[
		["rowid,name,description,zid,wkb_geometry","mmid, name, description,zid, wkb_geometry"],
		["hu_id,com_sub_real,plotname,speciesname,m_dbh,max_dbh,min_dbh,n_stems,stemsha,basalha,zid,mean_height,wkb_geometry"],
		["hu_id,com_sub_real,speciesname,m_dbh,m_stemsha,m_basalha,zid,m_height,wkb_geometry"]
	];
	var sqlQuery="INSERT INTO "+schemaf+".plot_locations ("+fields[0][0]+") (SELECT "+fields[0][1]+" from "+schema+".plot_locations);";
	sqlQuery+="INSERT INTO "+schemaf+".plotestimates ("+fields[1][0]+") (SELECT "+fields[1][0]+" from "+schema+".plotestimates);";
	sqlQuery+="INSERT INTO "+schemaf+".comsubestimates ("+fields[2][0]+") (SELECT "+fields[2][0]+" from "+schema+".comsubestimates);";
        sqlQuery+="UPDATE "+schemaf+".zip_files set wkb_geometry=(select ST_Multi(ST_Union("+schema+".plot_locations.wkb_geometry)) from "+schema+".plot_locations) where id="+currentId+";";
	sqlQuery+="DELETE FROM "+schema+".plot_locations;";
	sqlQuery+="DELETE FROM "+schema+".plotestimates;";
	sqlQuery+="DELETE FROM "+schema+".comsubestimates;";
	sqlQuery+="SELECT count(*) from "+schema+".comsubestimates;";

        var myOutputs= {"Result":{  type: 'RawDataOutput', "mimeType": "application/json" }};
        var myInputs={
                "dsoName": {"value": "","type":"string"},
                "dstName": {"value": "PG:dbname="+conf["mmdb"]["dbname"]+" port="+conf["mmdb"]["port"]+" host="+conf["mmdb"]["host"]+" user="+conf["mmdb"]["user"]+(conf["mmdb"]["password"]?" password="+conf["mmdb"]["password"]:""),"type":"string"},
                "q": {"value": sqlQuery,"mimeType":"application/json"},
        };
        var myProcess = new ZOO.Process(conf["main"]["serverAddress"],'vector-tools.vectInfo');
        var myExecuteResult=myProcess.Execute(myInputs,myOutputs);
        alert(myExecuteResult);
	
    }
    return {result: ZOO.SERVICE_SUCCEEDED, conf: conf, outputs: {Result: {"value": "Data successfully published"}}};
}

function setValidity(conf,inputs,outputs){
    var archive=null;
    var prefixValue="FDCPostThin";
    if(inputs["validity"]["value"]=="true"){
        alert("OK RUN !!");
        var schema="cmdii";
        var sql4comsubs="SELECT id, hu_id, com_sub_real as comp_sub, speciesname, m_dbh, m_stemsha, m_basalha from cmdii.comsubestimates where zid="+inputs["id"]["value"];
        var sql4comsubCentroids="SELECT id, hu_id, com_sub_real as comp_sub, speciesname as spname, m_dbh, m_stemsha, m_basalha, (select ST_Centroid(wkb_geometry) from cmdii.scdb where compartmen||subid=com_sub_real ) as wkb_geometry from cmdii.comsubestimates where speciesname!='Dead' and zid="+inputs["id"]["value"];
        var sql4locations="SELECT mmid as id, name, description as html, (select compartmen||''||subid as cuid from cmdii.scdb where ST_Intersects(cmdii.plot_locations.wkb_geometry,cmdii.scdb.wkb_geometry)) as comp_sub, wkb_geometry from cmdii.plot_locations where zid="+inputs["id"]["value"];
        var sql4estimates="SELECT id, hu_id, com_sub_real as comp_sub, plotname, speciesname, m_dbh, max_dbh, min_dbh, n_stems, stemsha, basalha, (select compartmen||''||subid as cuid from cmdii.scdb where ST_Intersects((select cmdii.plot_locations.wkb_geometry from cmdii.plot_locations where name=cmdii.plotestimates.plotname limit 1),cmdii.scdb.wkb_geometry) and (select cmdii.plot_locations.wkb_geometry from cmdii.plot_locations where name=cmdii.plotestimates.plotname limit 1) && cmdii.scdb.wkb_geometry) from cmdii.plotestimates where zid="+inputs["id"]["value"];
        var sql4MDIIPoints="SELECT id,hu,compartment,subcompartment,comment,wkb_geometry FROM mdii.points where ST_Intersects(mdii.points.wkb_geometry,(select wkb_geometry from cmdii.scdb where ST_Intersects(cmdii.scdb.wkb_geometry,(select ST_Union(wkb_geometry) from cmdii.plot_locations where zid="+inputs["id"]["value"]+"))))";
        var sql4MDIILines="SELECT id, hu,compartment,subcompartment,comment,wkb_geometry FROM mdii.lines where ST_Intersects(mdii.lines.wkb_geometry,(select wkb_geometry from cmdii.scdb where ST_Intersects(cmdii.scdb.wkb_geometry,(select ST_Union(wkb_geometry) from cmdii.plot_locations where zid="+inputs["id"]["value"]+"))))";
        
	var dbUser=conf[conf["main"]["dbuserName"]];
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "CSV"},
	    "nln": {"dataType":"string", "type":"literal", "value": "PlotCombSubEstimates"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"PlotCombSubEstimates_"+conf["lenv"]["usid"]+".csv"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4comsubs }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "CSV"},
	    "nln": {"dataType":"string", "type":"literal", "value": "PlotEstimates"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"PlotEstimates_"+conf["lenv"]["usid"]+".csv"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4estimates }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "ESRI Shapefile"},
	    "nln": {"dataType":"string", "type":"literal", "value": "PlotLocations"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"PlotLocations_"+conf["lenv"]["usid"]+".shp"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4locations }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);
        /**
         * Create ComsubEstimates Centroid shapefile
         */
         var sqlQuery="select create_sql_species_fields("+inputs["id"]["value"]+")";
    var myOutputs= {"Result":{  type: 'RawDataOutput', "mimeType": "application/json" }};
    var myInputs={
        "dsoName": {"value": "","type":"string"},
        "dstName": {"value": "PG:dbname="+conf["mmdb"]["dbname"]+" port="+conf["mmdb"]["port"]+" host="+conf["mmdb"]["host"]+" user="+conf["mmdb"]["user"]+(conf["mmdb"]["password"]?" password="+conf["mmdb"]["password"]:""),"type":"string"},
        "q": {"value": sqlQuery,"mimeType":"application/json"},
    };
    var myProcess = new ZOO.Process(conf["main"]["serverAddress"],'vector-tools.vectInfo');
    var myExecuteResult=myProcess.Execute(myInputs,myOutputs);
    alert(myExecuteResult);
	var tmp=eval(myExecuteResult);
	myExecuteResult=tmp[0]["create_sql_species_fields"];
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "ESRI Shapefile"},
	    "nln": {"dataType":"string", "type":"literal", "value": "ComsubCentroid"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"ComsubCentroid_"+conf["lenv"]["usid"]+".shp"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": myExecuteResult /*sql4comsubCentroids*/ }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);

        /**
         * Create MDII Points shapefile
         */
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "ESRI Shapefile"},
	    "nln": {"dataType":"string", "type":"literal", "value": "Points"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"Points_"+conf["lenv"]["usid"]+".shp"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4MDIIPoints }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);
        /**
         * Create MDII Lines shapefile
         */
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "ESRI Shapefile"},
	    "nln": {"dataType":"string", "type":"literal", "value": "Lines"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"Lines_"+conf["lenv"]["usid"]+".shp"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4MDIILines }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);

	var inputs02={
	    "dstn": {"dataType":"string", "type":"literal", "value": "PlotArchive_"+conf["lenv"]["usid"]+".zip"},
	    "dso": {"dataType":"string", "type":"literal", "value": prefixValue+"*"+conf["lenv"]["usid"]}
	};
        var myOutputs02= {"Result": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.doZip');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);
        archive=conf["main"]["tmpPath"]+"/PlotArchive_"+conf["lenv"]["usid"]+".zip";
    }
    var sqlQuery="update cmdii.zip_files set comment=$q$"+(inputs["comment"]?inputs["comment"]["value"]:"")+"$q$, valid="+inputs["validity"]["value"]+" where id="+inputs["id"]["value"]+";select valid from cmdii.zip_files where id="+inputs["id"]["value"]+";";
    var myOutputs= {"Result":{  type: 'RawDataOutput', "mimeType": "application/json" }};
    var myOutputs= {"Result":{  type: 'RawDataOutput', "mimeType": "application/json" }};
    var myInputs={
        "dsoName": {"value": "","type":"string"},
        "dstName": {"value": "PG:dbname="+conf["mmdb"]["dbname"]+" port="+conf["mmdb"]["port"]+" host="+conf["mmdb"]["host"]+" user="+conf["mmdb"]["user"]+(conf["mmdb"]["password"]?" password="+conf["mmdb"]["password"]:""),"type":"string"},
        "q": {"value": sqlQuery,"mimeType":"application/json"},
    };
    var myProcess = new ZOO.Process(conf["main"]["serverAddress"],'vector-tools.vectInfo');
    var myExecuteResult=myProcess.Execute(myInputs,myOutputs);
    alert(myExecuteResult);
    var myProcess = new ZOO.Process(conf["main"]["serverAddress"],localModulePath+'.sendmail0');
    var myInputs={
    };
    var isValid=false;
    for(i in inputs){
      alert(i);
      alert(inputs[i]["value"])
      if(i=="attachment"){
        myInputs[i]={"type":"complex","mimeType":inputs[i]["miimeType"],"xlink":"file://"+(archive!=null?archive:inputs[i]["cache_file"])};
      }else{
        if(i=="comment"){
            if(inputs[i]["value"].length>0)
            myInputs[i]={"type":"complex","mimeType":"application/json","value":inputs[i]["value"]};
        } else{
            if(inputs["validity"]["value"]=="true" && i=="mailTo"){
               // myInputs[i]={"type":"string","value":"Daniel.McInerney@coillte.ie"};
                isValid=true;
                myInputs[i]={"type":"string","value":"anna.ciolkowska@coillte.ie"};
            }
            else
                myInputs[i]={"type":"string","value":""+inputs[i]["value"]};
        }
      }
    }
    var myExecuteResult=myProcess.Execute(myInputs,myOutputs);
    alert(myExecuteResult);
    if(isValid){
      myInputs["mailTo"]["value"]="rita.oshea@coillte.ie";
      var myExecuteResult=myProcess.Execute(myInputs,myOutputs);
      alert(myExecuteResult);
    }
    return {result: ZOO.SERVICE_SUCCEEDED, conf: conf, outputs: {Result: {"value": "Data successfully saved"}}};
}

function produceValidatedZipFile(conf,inputs,outputs){
    var archive=null;
    var prefixValue="Global_FDCPostThin";
    var clause="(select id from cmdii.zip_files where valid is not null and valid)";
    {
        alert("OK RUN !!");
        var schema="cmdii";
        var sql4comsubs="SELECT id, hu_id, com_sub_real as comp_sub, speciesname, m_dbh, m_stemsha, m_basalha, (select max(split_part(split_part(description,'<b>Date:</b>',2),'<br>',1)) from cmdii.plot_locations where cmdii.plot_locations.zid=cmdii.comsubestimates.zid) as ba_date, (select max(edition_date)::text from mm_ghosts.cmdii_zip_files  where valid and mm_ghosts.cmdii_zip_files.id=cmdii.comsubestimates.zid) as validation_date from cmdii.comsubestimates where zid in "+clause;
        var sql4comsubCentroids="SELECT id, hu_id, com_sub_real as comp_sub, speciesname as spname, m_dbh, m_stemsha, m_basalha, (select max(split_part(split_part(description,'<b>Date:</b>',2),'<br>',1)) from cmdii.plot_locations where cmdii.plot_locations.zid=cmdii.comsubestimates.zid) as ba_date, (select max(edition_date)::text from mm_ghosts.cmdii_zip_files  where valid and mm_ghosts.cmdii_zip_files.id=cmdii.comsubestimates.zid) as validation_date, (select ST_Centroid(wkb_geometry) from cmdii.scdb where compartmen||subid=com_sub_real ) as wkb_geometry from cmdii.comsubestimates where speciesname!='Dead' and zid in "+clause;
        var sql4locations="SELECT mmid as id, name, description as html, (select compartmen||''||subid as cuid from cmdii.scdb where ST_Intersects(cmdii.plot_locations.wkb_geometry,cmdii.scdb.wkb_geometry)) as comp_sub, wkb_geometry from cmdii.plot_locations where zid in "+clause;
        var sql4estimates="SELECT id, hu_id, com_sub_real as comp_sub, plotname, speciesname, m_dbh, max_dbh, min_dbh, n_stems, stemsha, basalha, (select compartmen||''||subid as cuid from cmdii.scdb where ST_Intersects((select cmdii.plot_locations.wkb_geometry from cmdii.plot_locations where name=cmdii.plotestimates.plotname limit 1),cmdii.scdb.wkb_geometry) and (select cmdii.plot_locations.wkb_geometry from cmdii.plot_locations where name=cmdii.plotestimates.plotname limit 1) && cmdii.scdb.wkb_geometry) from cmdii.plotestimates where zid in "+clause;
        var sql4MDIIPoints="SELECT id,hu,compartment,subcompartment,comment,wkb_geometry FROM mdii.points where (mdii.points.wkb_geometry && (select ST_Union(wkb_geometry) from cmdii.scdb where (cmdii.scdb.wkb_geometry && (select ST_Union(wkb_geometry) from cmdii.plot_locations where zid in "+clause+")) and ST_Intersects(cmdii.scdb.wkb_geometry,(select ST_Union(wkb_geometry) from cmdii.plot_locations where zid in "+clause+")))) and ST_Intersects(mdii.points.wkb_geometry,(select ST_Union(wkb_geometry) from cmdii.scdb where (cmdii.scdb.wkb_geometry && (select ST_Union(wkb_geometry) from cmdii.plot_locations where zid in "+clause+")) and ST_Intersects(cmdii.scdb.wkb_geometry,(select ST_Union(wkb_geometry) from cmdii.plot_locations where zid in "+clause+"))))";
        var sql4MDIILines="SELECT id, hu,compartment,subcompartment,comment,wkb_geometry FROM mdii.lines where (mdii.lines.wkb_geometry && (select ST_Union(wkb_geometry) from cmdii.scdb where (cmdii.scdb.wkb_geometry && (select ST_Union(wkb_geometry) from cmdii.plot_locations where zid in "+clause+")) and ST_Intersects(cmdii.scdb.wkb_geometry,(select ST_Union(wkb_geometry) from cmdii.plot_locations where zid in "+clause+")))) and ST_Intersects(mdii.lines.wkb_geometry,(select ST_Union(wkb_geometry) from cmdii.scdb where (cmdii.scdb.wkb_geometry && (select ST_Union(wkb_geometry) from cmdii.plot_locations where zid in "+clause+")) and ST_Intersects(cmdii.scdb.wkb_geometry,(select ST_Union(wkb_geometry) from cmdii.plot_locations where zid in "+clause+"))))";

	conf["lenv"]["message"]="Produce "+prefixValue+"PlotCombSubEstimates_"+conf["lenv"]["usid"]+".csv ...";
	ZOOUpdateStatus(conf,15);
	var dbUser=conf[conf["main"]["dbuserName"]];
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "CSV"},
	    "nln": {"dataType":"string", "type":"literal", "value": "PlotCombSubEstimates"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"PlotCombSubEstimates_"+conf["lenv"]["usid"]+".csv"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4comsubs }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);

	conf["lenv"]["message"]="Produce "+prefixValue+"PlotEstimates_"+conf["lenv"]["usid"]+".csv ...";
	ZOOUpdateStatus(conf,30);
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "CSV"},
	    "nln": {"dataType":"string", "type":"literal", "value": "PlotEstimates"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"PlotEstimates_"+conf["lenv"]["usid"]+".csv"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4estimates }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);
	
	conf["lenv"]["message"]="Produce "+prefixValue+"PlotLocations_"+conf["lenv"]["usid"]+".shp ...";
	ZOOUpdateStatus(conf,45);
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "ESRI Shapefile"},
	    "nln": {"dataType":"string", "type":"literal", "value": "PlotLocations"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"PlotLocations_"+conf["lenv"]["usid"]+".shp"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4locations }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);
	
        /**
         * Create ComsubEstimates Centroid shapefile
         */
	conf["lenv"]["message"]="Produce "+prefixValue+"ComsubCentroid_"+conf["lenv"]["usid"]+".shp ...";
	ZOOUpdateStatus(conf,50);
	var orderBySpeciesCount="select zid as id from (select count( * ) as c, com_sub_real,zid from cmdii.comsubestimates group by zid,com_sub_real) as b where b.zid in "+clause+" group by zid order by max(c) desc";
	var myOutputs0= {"Result":{  type: 'RawDataOutput', "mimeType": "application/json" }};
	var myInputs0={
            "dsoName": {"value": "","type":"string"},
            "dstName": {"value": "PG:dbname="+conf["mmdb"]["dbname"]+" port="+conf["mmdb"]["port"]+" host="+conf["mmdb"]["host"]+" user="+conf["mmdb"]["user"]+(conf["mmdb"]["password"]?" password="+conf["mmdb"]["password"]:""),"type":"string"},
            "q": {"value": orderBySpeciesCount,"mimeType":"application/json"},
	};
	var myProcess = new ZOO.Process(conf["main"]["serverAddress"],'vector-tools.vectInfo');
	var myExecuteResult0=myProcess.Execute(myInputs0,myOutputs0);
	alert(myExecuteResult0);
	var idList=eval(myExecuteResult0);
	for(var i=0;i<idList.length;i++){
	    ZOOUpdateStatus(conf,50+((25*(i+1))/idList.length));	    
            var sqlQuery="select create_sql_species_fields("+idList[i]["id"]+")";
	    var myOutputs= {"Result":{  type: 'RawDataOutput', "mimeType": "application/json" }};
	    var myInputs={
		"dsoName": {"value": "","type":"string"},
		"dstName": {"value": "PG:dbname="+conf["mmdb"]["dbname"]+" port="+conf["mmdb"]["port"]+" host="+conf["mmdb"]["host"]+" user="+conf["mmdb"]["user"]+(conf["mmdb"]["password"]?" password="+conf["mmdb"]["password"]:""),"type":"string"},
		"q": {"value": sqlQuery,"mimeType":"application/json"},
	    };
	    var myProcess = new ZOO.Process(conf["main"]["serverAddress"],'vector-tools.vectInfo');
	    var myExecuteResult=myProcess.Execute(myInputs,myOutputs);
	    alert(myExecuteResult);
	    var tmp=eval(myExecuteResult);
	    myExecuteResult=tmp[0]["create_sql_species_fields"];
	    var inputs02={
		"f": {"dataType":"string", "type":"literal", "value": "ESRI Shapefile"},
		"nln": {"dataType":"string", "type":"literal", "value": prefixValue+"ComsubCentroid_"+conf["lenv"]["usid"]},
		"lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
		"InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
		"OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"ComsubCentroid_"+conf["lenv"]["usid"]+".shp"},
		"sql": {"mimeType":"text/plain", "type":"complex", "value": myExecuteResult /*sql4comsubCentroids*/ }
	    }
	    if(i>0){
		inputs02["append"]={"dataType":"string", "type":"literal", "value": "true"};
		inputs02["update"]={"dataType":"string", "type":"literal", "value": "true"};
	    }else
		inputs02["overwrite"]={"dataType":"string", "type":"literal", "value": "true"};
	    var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	    var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
            var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
            alert(myExecuteResult02);
	}
	
        /**
         * Create MDII Points shapefile
         */
	conf["lenv"]["message"]="Produce "+prefixValue+"Points_"+conf["lenv"]["usid"]+".shp ...";
	ZOOUpdateStatus(conf,80);

	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "ESRI Shapefile"},
	    "nln": {"dataType":"string", "type":"literal", "value": "Points"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"Points_"+conf["lenv"]["usid"]+".shp"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4MDIIPoints }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);
	
        /**
         * Create MDII Lines shapefile
         */
	conf["lenv"]["message"]="Produce "+prefixValue+"Lines_"+conf["lenv"]["usid"]+".shp ...";
	ZOOUpdateStatus(conf,90);
	var inputs02={
	    "skipfailure": {"dataType":"string", "type":"literal", "value": "true"},
	    "f": {"dataType":"string", "type":"literal", "value": "ESRI Shapefile"},
	    "nln": {"dataType":"string", "type":"literal", "value": "Lines"},
	    "lco": {"dataType":"string", "type":"literal", "value": "SPATILALITE=YES"},
	    "InputDSN": {"dataType":"string", "type":"literal", "value": "PG:dbname="+dbUser["dbname"]+" port="+dbUser["port"]+" user="+dbUser["user"]+""+(dbUser["password"]?" password="+dbUser["password"]:"")},
	    "OutputDSN": {"dataType":"string", "type":"literal", "value": prefixValue+"Lines_"+conf["lenv"]["usid"]+".shp"},
	    "sql": {"mimeType":"text/plain", "type":"complex", "value": sql4MDIILines }
	}
	var myOutputs02= {"OutputedDataSourceName": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.Ogr2Ogr');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);

	var inputs02={
	    "dstn": {"dataType":"string", "type":"literal", "value": "Global_PlotArchive_"+conf["lenv"]["usid"]+".zip"},
	    "dso": {"dataType":"string", "type":"literal", "value": prefixValue+"*"+conf["lenv"]["usid"]}
	};
        var myOutputs02= {"Result": { type: 'RawDataOutput', "mimeType": "plain/text" }};
	var myProcess02 = new ZOO.Process(conf["main"]["serverAddress"],'vector-converter.doZip');
        var myExecuteResult02=myProcess02.Execute(inputs02,myOutputs02);
        alert(myExecuteResult02);
        archive=conf["main"]["tmpPath"]+"/Global_PlotArchive_"+conf["lenv"]["usid"]+".zip";
    }

    var sqlQuery="INSERT INTO cmdii.generated_zips (filename) VALUES ($q$"+archive+"$q$);";
    var myOutputs= {"Result":{  type: 'RawDataOutput', "mimeType": "application/json" }};
    var myInputs={
        "dsoName": {"value": "","type":"string"},
        "dstName": {"value": "PG:dbname="+conf["mmdb"]["dbname"]+" port="+conf["mmdb"]["port"]+" host="+conf["mmdb"]["host"]+" user="+conf["mmdb"]["user"]+(conf["mmdb"]["password"]?" password="+conf["mmdb"]["password"]:""),"type":"string"},
        "q": {"value": sqlQuery,"mimeType":"application/json"},
    };
    var myProcess = new ZOO.Process(conf["main"]["serverAddress"],'vector-tools.vectInfo');
    var myExecuteResult=myProcess.Execute(myInputs,myOutputs);

    alert(archive);
    outputs["Result"]["generated_file"]=archive;
    outputs["Result"]["storage"]=archive;
    return {result: ZOO.SERVICE_SUCCEEDED, conf: conf, outputs: outputs};
}

