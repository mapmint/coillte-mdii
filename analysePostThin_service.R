################################################################################
##  Author:   Gérald Fenoy, gerald.fenoy@geolabs.fr
##            Daniel McInerney, daniel.mcinerney@coillte.ie
##
##  Copyright (c) 2019 Coillte Teoranta. All rights reserved.
##
##  This work has been supported by Coillte Teoranta, Forest Resource Planning
################################################################################
##  Permission is hereby granted, free of charge, to any person obtaining a
##  copy of this software and associated documentation files (the "Software"),
##  to deal in the Software without restriction, including without limitation
##  the rights to use, copy, modify, merge, publish, distribute, sublicense,
##  and/or sell copies of the Software, and to permit persons to whom the
##  Software is furnished to do so, subject to the following conditions:
## 
##  The above copyright notice and this permission notice shall be included
##  in all copies or substantial portions of the Software.
## 
##  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
##  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
##  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
##  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
##  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
##  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
##  DEALINGS IN THE SOFTWARE.
################################################################################
source("minimal.r")

suppressPackageStartupMessages(library(readxl))
suppressPackageStartupMessages(library(dplyr))
suppressPackageStartupMessages(library(ggplot2))
suppressPackageStartupMessages(library(RSQLite))

analyze <- function(conf,inputs,outputs) {
    sink(stderr())
    # args <- commandArgs(TRUE)
    posthinDB <- inputs[["db"]][["value"]]
    inputData <- inputs[["data"]][["cache_file"]]

    ## set up database connection
    drv <- dbDriver('SQLite')
    con <- dbConnect(drv, posthinDB)

    data <- read_excel(inputData)

    zoo[["conf"]][["lenv"]][["message"]] <<- 'Post Thin data read in...'

    ##write field measurements to the SQLite table
    dbWriteTable(con, "fieldmeasurements", data, append=TRUE)

    ##handle 0 in the com_sub if it has been incorrectly entered
    data %>% mutate(Comp_sub=ifelse(substr(Comp_sub,6,6)==0, paste(substr(Comp_sub,1,5),'O',substr(Comp_sub,7,7),sep=''), paste(substr(Comp_sub,1,7)))) -> data

    ##generate the data for the plot location table
    data %>% select(HU_ID, Comp_sub, Plotname, Plotdate, 'Plotlocation - Latitude', 'Plotlocation - Longitude') %>%
	rename('Lat' = 'Plotlocation - Latitude') %>%
	rename('Long' = 'Plotlocation - Longitude') %>%
	unique() -> plotLocation

    ##write field measurements to the SQLite table
    dbWriteTable(con, "plotLocation", plotLocation, append=TRUE)

    zoo[["conf"]][["lenv"]][["message"]] <<- 'Plot location created and uploaded...'

    ##calculate the Plot Level Estimates
    data %>% mutate(ba = pi * (Diameter/10)^2 / 40000) %>%
        mutate_at(vars(Height), ~replace(., . == 0, NA)) %>%
        group_by(HU_ID, Comp_sub, Plotname, Speciesname) %>%
        summarize(m_dbh = round(mean(Diameter)/10,1),
                  max_dbh = round(max(Diameter)/10,1),
                  min_dbh = round(min(Diameter)/10,1),
                  mean_height = round(mean(na.omit(Height)),1),
                  n_stems = n(),
                  stemsha = as.integer(n()/mean(Plotsize)),
                  basalha = round(sum(ba)/mean(Plotsize),1)) -> plotEstimates

    ##write field measurements to the SQLite table
    dbWriteTable(con, "plotEstimates", plotEstimates, append=TRUE)

    ##calculate the Sub-compartment Estimates
    plotEstimates %>% group_by(HU_ID, Comp_sub, Speciesname) %>%
        summarize(m_dbh = round(mean(m_dbh),1),
                m_stemsha = as.integer(mean(stemsha)),
                m_height = round(mean(mean_height)),
                m_basalha = round(mean(basalha),1)) -> comsubEstimates

    			

    zoo[["conf"]][["lenv"]][["message"]] <<- 'Sub-compartment estimates generated and uploaded...'
    ##write field measurements to the SQLite table
    dbWriteTable(con, "comsubEstimates", comsubEstimates, append=TRUE)

    # Set the result
    zoo[["outputs"]][["Result"]][["generated_file"]] <<- posthinDB
    
    cat('\n')
    cat('\n')
    cat('\n')
    
    # Return SERVICE_SUCCEEDEED
    return(zoo[["SERVICE_SUCCEEDEED"]])
    
    ##SELECT InitSpatialMetaData();
    ##SELECT AddGeometryColumn('plotLocation', 'Geometry', 4326, 'POINT', 2);
    ##UPDATE plotLocations SET Geometry=MakePoint(Long, Lat, 4326);
}

