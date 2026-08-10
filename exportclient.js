'use strict';
/**********************************************************************
 * Copyright (C) 2026 Mr. Green & MCS
 * 
 * exportclient.js - Čisto Front-End Rješenje (Bypass 404 Greške)
 **********************************************************************/

module.exports.exportclient = function (parent) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent.parent;

    obj.exports = [
        'onDeviceRefreshEnd'
    ];

    obj.onDeviceRefreshEnd = function () {
        // Preskačemo ako nema otvorenog računala
        if (typeof currentNode == 'undefined' || currentNode == null) return;
        
        var p19 = document.getElementById('p19');
        if (!p19) return;

        // Sprječavanje duplikata - ako panel već postoji, prekidamo (tipke će same uzeti svježe podatke)
        var myPanel = document.getElementById('panel-exportclient');
        if (myPanel) return; 

        // 1. Pronalazak menija ostalih pluginova (Ryan Blenis stil)
        var pluginNav = null;
        var links = p19.getElementsByTagName('a');
        for (var i = 0; i < links.length; i++) {
            if (links[i].innerHTML.indexOf('ScriptTask') !== -1 || links[i].innerHTML.indexOf('Work From Home') !== -1 || links[i].innerHTML.indexOf('Event Log') !== -1) {
                pluginNav = links[i].parentNode;
                break;
            }
        }

        // Ako nema drugih pluginova, mi crtamo prvi izbornik
        if (!pluginNav) {
            pluginNav = document.createElement('div');
            pluginNav.id = 'pluginNav';
            pluginNav.style.paddingBottom = '15px';
            pluginNav.style.fontSize = '14px';
            var p19title = document.getElementById('p19title');
            if (p19title && p19title.nextSibling) {
                p19.insertBefore(pluginNav, p19title.nextSibling);
            } else {
                p19.insertBefore(pluginNav, p19.firstChild);
            }
        }

        // Dodavanje našeg linka uz separator
        if (pluginNav.children.length > 0) {
            var sep = document.createElement('span');
            sep.innerHTML = ' <span style="color:#888;">|</span> ';
            pluginNav.appendChild(sep);
        }

        var myLink = document.createElement('a');
        myLink.id = 'nav-exportclient';
        myLink.href = '#';
        myLink.innerHTML = 'Client Export';
        myLink.style.cursor = 'pointer';
        pluginNav.appendChild(myLink);

        // 2. Kreiranje panela s tipkama
        myPanel = document.createElement('div');
        myPanel.id = 'panel-exportclient';
        myPanel.style.display = 'none';
        myPanel.innerHTML = `
            <div style="border:1px solid #ddd; padding:20px; border-radius:5px; background-color:#f9f9f9; margin-top:15px;">
                <h4 style="margin-top:0; color:#333; font-weight:bold;">mTicket Client Export</h4>
                <p style="font-size:13px; color:#666; margin-bottom:15px;">Brzo preuzmite hardversku specifikaciju i popis softvera direktno iz preglednika.</p>
                <button id="btn-export-csv" class="btn btn-secondary btn-sm" style="margin-right:10px;">Preuzmi CSV</button>
                <button id="btn-export-ticket" class="btn btn-primary btn-sm">Preuzmi TXT (Ticketing)</button>
            </div>
        `;
        p19.appendChild(myPanel);

        // Prebacivanje prikaza
        myLink.onclick = function(e) {
            e.preventDefault();
            for (var i = 0; i < p19.children.length; i++) {
                var child = p19.children[i];
                if (child.id === 'p19title' || child === pluginNav || child === myPanel) continue;
                child.style.display = 'none';
            }
            myPanel.style.display = 'block';
        };

        // ====================================================================
        // FRONT-END DOWNLOAD GENERATOR (Izrada datoteka bez servera)
        // ====================================================================
        function downloadFile(filename, content, type) {
            var blob = new Blob([content], { type: type });
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function() {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);
        }

        // KLIK NA CSV GUMB
        document.getElementById('btn-export-csv').onclick = function(e) { 
            e.preventDefault();
            var n = currentNode; // Trenutno otvoreno računalo u pregledniku
            var safeName = (n.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            var csv = "Kategorija,Svojstvo,Vrijednost\n";
            csv += "Osnovno,Ime," + (n.name || 'Nepoznato') + "\n";
            csv += "Osnovno,Opis," + (n.desc || '') + "\n";
            csv += "Osnovno,OS," + (n.osdesc || n.mtype || '') + "\n";
            
            if (n.software) {
                var swList = n.software.apps || n.software;
                if (Array.isArray(swList)) {
                    swList.forEach(function(app) {
                        var appName = (app.name || app.N || 'Nepoznato').replace(/,/g, ' '); 
                        var appVer = (app.version || app.V || '').replace(/,/g, ' ');
                        csv += "Softver," + appName + "," + appVer + "\n";
                    });
                }
            }

            downloadFile(safeName + '_export.csv', csv, 'text/csv;charset=utf-8;');
        };

        // KLIK NA TXT GUMB
        document.getElementById('btn-export-ticket').onclick = function(e) { 
            e.preventDefault();
            var n = currentNode;
            var safeName = (n.name || 'racunalo').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            var txt = "=== MESH CENTRAL TICKET EXPORT ===\n";
            txt += "MC_NODE_ID: " + n._id + "\n";
            txt += "HOSTNAME: " + (n.name || 'N/A') + "\n";
            txt += "OS_TYPE: " + (n.osdesc || n.mtype || 'N/A') + "\n";
            txt += "DESCRIPTION: " + (n.desc || 'N/A') + "\n";
            
            if (n.host) txt += "LAST_IP: " + n.host + "\n";
            
            txt += "--- HARDWARE ---\n";
            // Povlačimo hardware JSON stablo direktno iz memorije preglednika
            var hw = n.hwinfo || n.coreinfo || 'Nema hardverskih podataka';
            txt += typeof hw === 'object' ? JSON.stringify(hw, null, 2) : hw;
            txt += "\n=== END OF EXPORT ===\n";

            downloadFile(safeName + '_ticket.txt', txt, 'text/plain;charset=utf-8;');
        };
    };

    return obj;
};