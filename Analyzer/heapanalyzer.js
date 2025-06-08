// analyze.js

function analyzeMapTextfield() {
    var text = document.getElementById("TEXTAREA").value;
    var output = analyzeHeapDump(text);
    displayOutput(output);
}

function analyzeMapFile() {
    var fileInput = document.getElementById("FILE");
    var file = fileInput.files[0];
    var reader = new FileReader();
    
    reader.onload = function(event) {
        var text = event.target.result;
        var output = analyzeHeapDump(text);
        displayOutput(output);
    };
    
    reader.readAsText(file);
}
 
function analyzeHeapDump(text) {
    var lines = text.split("\n");
    var heapData = [];

    lines.forEach(function(line) {
        var columns = line.trim().split(/\s+/);
        if (columns.length < 4) return;

        var num = columns[0];
        var instances = parseInt(columns[1]);
        var bytes = parseInt(columns[2]);
        var className = columns.slice(3).join(" ");

        if (!isNaN(instances) && !isNaN(bytes) && className.indexOf("paid") !== -1) {
            heapData.push({ 
                num: num, 
                instances: instances, 
                bytes: bytes, 
                className: className 
            });
        }
    });

    heapData.sort(function(a, b) {
        return b.bytes - a.bytes;
    });

    return heapData;
}

function displayOutput(heapData) {
    var outputDiv = document.getElementById("OUTPUT");
    outputDiv.innerHTML = "";

    var table = document.createElement("table");
    table.border = "1";

    var headerRow = document.createElement("tr");
    ["Num", "#Instances", "#Bytes", "Class Name (Module)"].forEach(function(header) {
        var th = document.createElement("th");
        th.appendChild(document.createTextNode(header));
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    heapData.forEach(function(row) {
        var tr = document.createElement("tr");

        for (var key in row) {
            if (row.hasOwnProperty(key)) {
                var td = document.createElement("td");
                td.appendChild(document.createTextNode(row[key]));
                tr.appendChild(td);
            }
        }

        table.appendChild(tr);
    });

    outputDiv.appendChild(table);
    document.getElementById("OUTPUT_DIV").style.display = "block";
}
