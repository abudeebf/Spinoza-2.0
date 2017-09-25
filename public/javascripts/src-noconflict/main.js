
//     /// <reference path="../vendor/DefinitelyTyped/node/node.d.ts" />
// var JVM = doppio.JVM, testing = doppio.testing, java_cli = doppio.javaCli, process = BrowserFS.BFSRequire('process'), Buffer = BrowserFS.BFSRequire('buffer').Buffer, 
//     // To be initialized on document load
//     stdout, user_input, controller, editor, jvm_state, sys_path = '/sys';
  

// var host="http://spinoza.cs-i.brandeis.edu:3000/";
//  host="localhost:3000/";
//  function runjavac(args) {
//   var JVM = doppio.JVM, testing = doppio.testing, java_cli = doppio.javaCli, process = BrowserFS.BFSRequire('process'), Buffer = BrowserFS.BFSRequire('buffer').Buffer, 
//     // To be initialized on document load
//     stdout, user_input, controller, editor, jvm_state, sys_path = '/sys';
//   args.unshift('classes/util/Javac');
//             java_cli.java(args, constructJavaOptions({
//                 classpath: [sys_path],
//                 launcherName: 'javac'
//             }), function (status) {
//                 jvm_state = undefined;
               
//             }, function (jvm) {
//                 jvm_state = jvm;
//             });
//             return null;
//  }   
//  function runjavacomand(args)  {
//   var JVM = doppio.JVM, testing = doppio.testing, java_cli = doppio.javaCli, process = BrowserFS.BFSRequire('process'), Buffer = BrowserFS.BFSRequire('buffer').Buffer, 
//     // To be initialized on document load
//     stdout, user_input, controller, editor, jvm_state, sys_path = '/sys';
//    java_cli.java(args, constructJavaOptions({
//                 classpath: ['.'],
//                 launcherName: 'java'
//             }), function (result) {
//                 jvm_state = undefined;
               
//             }, function (jvm) {
//                 jvm_state = jvm;
//             });
//             return null;
//  } 
var host=window.location.origin+"/";
function getAttendance(){
   var d1= new Date($('#datetimepicker_mask').val());
   var d2= new Date($('#datetimepicker_mask2').val());
   var classId=$('#classId').val()
   var problems2=$("#myDropdownCheckbox").dropdownCheckbox("checked");
   var id2=""
   for (var i in problems2)
    id2=id2+problems2[i].id+",";
  
  if(d1<=d2 && id2!="")
  {

    var range=$('#datetimepicker_mask').val().replace(" ","_").replace(":","*") + ";" +$('#datetimepicker_mask2').val().replace(" ","_").replace(":","*");
    var re = new RegExp("/", 'g');
    range=range.replace(re,":");

    location.href=host+"getattendance/"+classId+"/"+range+"/"+id2;
 }
 else
 alert("start date should be less than or equal to the end date and you need to select at least one problemset");
} 

function handleClickps(checkBox){
  var parameters={"pid":checkBox.name,"show":checkBox.checked};
  $.post(host+'hideShowProblemset',parameters ,function(data){
   location.reload()
  });
}
function runAndTest(id1){
 var code=$('#code2').val();
    $('#tabs a[href="#stdout"]').tab('show');
    var parameters={code:code,id1:id1};
    $.post(host+'runjavacode2',parameters, function(data) {
        if (data.result.trim().length==0)
            $('textarea[name=stdout]').val("Program Result");
        else
            $('textarea[name=stdout]').val(data.result);
        name="testTable";
        if($("#" + name).length > 0) {
            $("#" + name).remove();
        }

        if(data.test.length > 0) {
            var table = $('<table id =' + name + '></table>').addClass("table-bordered table");
            row = $('<tr></tr>').addClass("badge-warning");
            row.append($('<th></th>').text("parameters"));
            row.append( $('<th></th>').text("expected"));
            row.append( $('<th></th>').text("result"));
            row.append($('<th></th>').text("match"));
            row.append($('<th></th>').text("comment"));
            table.append(row);
            for (var i=0; i<data.test.length-4;i=i+4){
                if(data.test[i+3]=='false')
                    row=$('<tr></tr>').addClass("alert-danger");
                else
                    row=$('<tr></tr>').addClass("success");
                for( var n=0;n<4;n++){
                    row.append($('<td></td>').html(data.test[i+n].replace(/\n/g, "<br />")));
                    if (n==3){
                      if(data.test[i+3]=='false'){
                        if(data.test[i+1].charAt(data.test[i+1].length-1)=="\n" && data.test[i+2].charAt(data.test[i+2].length-1)!="\n")
                          row.append($('<td></td>').text( " [expected contains \\n] at the end "));
                        else if (data.test[i+1].charAt(data.test[i+1].length-1)!="\n" && data.test[i+2].charAt(data.test[i+2].length-1)=="\n")
                           row.append($('<td></td>').text( " [expected does not contains \\n] at the end "));
                        else if (data.test[i+1].charAt(data.test[i+1].length-1)==" " && data.test[i+2].charAt(data.test[i+2].length-1)!=" ")
                          row.append($('<td></td>').text( " [[expected contains]] \"\" at the end"));
                        else if (data.test[i+1].charAt(data.test[i+1].length-1)!=" " && data.test[i+2].charAt(data.test[i+2].length-1)==" ")
                          row.append($('<td></td>').text( " [[expected does not contains]] \"\" at the end"));
                        else
                          row.append($('<td></td>').text(" not the same")); 
                      }
                      else row.append($('<td></td>').text(""));
                    }
                      
                    
                }
                table.append(row);
            }
                 row = $('<tr></tr>').addClass("badge-warning");
                 row.append($('<td colspan="5"></td>').text(data.test[data.test.length-1]));
                 table.append(row);
                $('#testr').append(table);

        }
        
    },'json');
}
function convertRGB(r,g,b) {
  var rgb= [];
  rgb = [r,g,b];
  return '#' + rgb.map(function(x){ 
    return ("0" + Math.round(x*255).toString(16)).slice(-2);
  }).join('');
};
function countPercent(part,total){
  return ((part/total)*100).toFixed(0);

}
function viewSubmission(hash,id1,section){
  location.href=host+'ViewSubmissionHash/'+id1+"/"+hash+"/"+section;
 
}
function makebuggyProblem(){
     var id1=document.getElementById("pid").value;
     if(document.getElementById("hashtest").value==0 || document.getElementById("hashtest").value==1)
      alert("you can not post this problem");
    else
      { 
         var code1=document.getElementById("code2").value;
         var parameters={id1:id1,code1:code1};
         $.post(host+'copybuggyproblem',parameters, function(data) {
           alert("you have succefully created a solution version")
          }
           );
         
      }
    }
function makeShareUser(users){
  var options = users;
  var emails=[];
  for(var i = 0; i < options.length; i++) {
    var opt=options[i].email;
     if(opt != "" && opt!=" " && opt !=undefined && opt!=null )
      emails.push(options[i].email) ;
     }
  $('#autocomplete').autocomplete({
    lookup: emails
  });
}
function grade(id1,student,grader){
  var comment=$('#comment').val();
  var grade=$('#grade').val();
  if(grade.trim().length==0){
    alert("Please give a garde to your student");
    $('#grade').focus();
  }
  else
 { 
    var parameters={comment:comment,grade:grade,id1:id1,student:student,grader:grader};
    $.post(host+'grade',parameters, function(data) {
     location.href=host+'problems/submission/'+id1}
     );
  }
}
function constructJavaOptions(customArgs) {
        if (customArgs === void 0) { customArgs = {}; }
        return underscore.extend({
            bootstrapClasspath: ['/sys/vendor/java_home/classes'],
            classpath: [],
            javaHomePath: '/sys/vendor/java_home',
            extractionPath: '/jars',
            nativeClasspath: ['/sys/src/natives']
        }, customArgs);
    }
function formatRows(rows){
      var  tmpColDelim = String.fromCharCode(11) // vertical tab character
        ,tmpRowDelim = String.fromCharCode(0) // null character
        // actual delimiter characters for CSV format
        ,colDelim = '","'
        ,rowDelim = '"\r\n"';
        return rows.get().join(tmpRowDelim)
            .split(tmpRowDelim).join(rowDelim)
            .split(tmpColDelim).join(colDelim);
}
 //------------------------------------------------------------
    // Helper Functions 
    //------------------------------------------------------------
    // Format the output so it has the appropriate delimiters
    
    // Grab and format a row from the table
    function grabRow(i,row){
         var  tmpColDelim = String.fromCharCode(11) // vertical tab character
        ,tmpRowDelim = String.fromCharCode(0) // null character
        // actual delimiter characters for CSV format
        ,colDelim = '","'
        ,rowDelim = '"\r\n"';
        var $row = $(row);
        //for some reason $cols = $row.find('td') || $row.find('th') won't work...
        var $cols = $row.find('td'); 
        if(!$cols.length) $cols = $row.find('th');  
        return $cols.map(grabCol)
                    .get().join(tmpColDelim);
    }
    // Grab and format a column from the table 
    function grabCol(j,col){
        var $col = $(col),
            $text = $col.text();
        return $text.replace('"', '""'); // escape double quotes
    }
  function exportTableToCSV($table, filename) {
    
    var $headers = $table.find('tr:has(th)')
        ,$rows = $table.find('tr:has(td)')
        // Temporary delimiter characters unlikely to be typed by keyboard
        // This is to avoid accidentally splitting the actual contents
        ,tmpColDelim = String.fromCharCode(11) // vertical tab character
        ,tmpRowDelim = String.fromCharCode(0) // null character
        // actual delimiter characters for CSV format
        ,colDelim = '","'
        ,rowDelim = '"\r\n"';
        // Grab text from table into CSV formatted string
        var csv = '"';
        csv += formatRows($headers.map(grabRow));
        csv += rowDelim;
        csv += formatRows($rows.map(grabRow)) + '"';
        // Data URI
        var csvData = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csv);
        alert(filename);
    $(this).attr({ 'download': filename,'href': csvData
            //,'target' : '_blank' //if you want it to open in a new window
    });
   
  }
function validate(){
  var AllRecords = $('#AllRecords');
 if (AllRecords.is(":checked")){
    $('#dates').hide();
   
  }else{
    $('#dates').show();
   
  }
}
function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}
function RefreshStat(sort){
var AllRecords = $('#AllRecords');
var classId=$('#classId').val()
 if (AllRecords.is(":checked"))
  location.href=host+"viewstudentstat/"+classId+"/"+sort+"/AllRecords";
 else {
   var d1= new Date($('#datetimepicker_mask').val());
   var d2= new Date($('#datetimepicker_mask2').val());
  if(d1<d2)
  {
    var range=$('#datetimepicker_mask').val() + ";" +$('#datetimepicker_mask2').val() ;
    var re = new RegExp("/", 'g');
    range=range.replace(re,":");
    location.href=host+"viewstudentstat/"+classId+"/"+sort+"/"+range;
 }
 else
 alert("start date should be less than the end date");
}
}
function saveTheme(theme) {
  var parameters={theme:theme};
  $.post(host+'editortheme',parameters, function(data) {
 
});
}

function saveMode(mode) {
  var parameters={mode:mode};
  $.post(host+'editorMode',parameters, function(data) {
 
});
}
function reset(id1){
 var parameters={id1:id1};
  $.post(host+'problems/reset',parameters, function(data) {
       
            $('textarea[name=result]').val("Program Result");
            var editor1 = ace.edit("editor");
            editor1.setValue(data.code);
 
});
}
function run(){
  var code=ace.edit("editor").getValue();
  var cn=$('#cn').val();
  var stdin= $('#stdIn').val();
  $('#tabs a:first').tab('show');
  if(cn.trim().length==0){
    //alert("Please give a name to your Java class");
    $('#cn').focus();
  }
  else
 {   if (cn.indexOf(".java")>-1){
    cn=cn.substring(0,cn.indexOf(".java"));
  }
    var parameters={code:code,cn:cn,std:stdin};
      $('textarea[name=result]').val("The programm is under either javac or java command");
    $.post(host+'runide',parameters, function(data) {
     
      if(data.result.length==0)
        $('textarea[name=result]').val(data.result);
      else
    $('textarea[name=result]').val(data.result);
   createFiles(data.files);
});}
}
function handleClick(checkBox){
  var parameters={"pid":checkBox.name,"show":checkBox.checked};
  $.post(host+'hideShowProblems',parameters ,function(data){
   location.reload()
  });
}
function allowCorrect(checkBox,id){
  
 var parameters={"pid":id,"allowCorrect":checkBox.checked};
  $.post(host+'allowCorrectProblems',parameters ,function(data){
   location.reload()
  });
}
function download(id,student,user){
  var code=$('#code2').val();
  var cn=$('#cn').val();
  if (cn.trim().length!=0){
  var parameters={cn:cn,code1:code};
  
  $.post(host+'update_user_problems',parameters ,function(data){
    
  });
}
else
  alert("please write you class Name ");

}
 
function run2(id,student,user,role){
  var code=ace.edit("editor").getValue();
  var cn=$('#cn').val();
  $('#tabs a:first').tab('show');
  var allow=$('#allow').val();
  var stdin= $('textarea[name=stdINN]').val();
  if(cn.trim().length==0)
  {
    $('#cn').focus();
  }
  else
  {   
      if (cn.indexOf(".java")>-1)
       {
         cn=cn.substring(0,cn.indexOf(".java"));
       }
      var parameters={code:code,cn:cn,id1:id,student:student,std:stdin,allow:allow};
      $('textarea[name=result]').val("The programm is under either javac or java command");
      $.post(host+'runclassexcerise',parameters, function(data) 
      {
         $('textarea[name=result]').val(data.result);

         if( student==user && role!= "adminteacher" )
          { 
            parameters={pid:id,code1:code,problemtype:"classproblem",cn:cn,hashvalue:data.hashvalue,std:stdin};
            $.post(host+'submit',parameters, function(data2){
               
          });
            
      }
          });
    }
}
function isString(o) {
    return typeof o == "string" || (typeof o == "object" && o.constructor === String);
}
function viewgraph(){
  var section=$('#choosesection').val();
  var k=$('#k').val();
  var minR=$('#minR').val();
  var classId=$('#classId').val();
  var id=$('#pid').val();
  location.href=host+classId+'[]'+id+'[]'+k+'[]'+minR+'[]'+section;
}
function shareWith(users){
  var name="shareTable";
   if(users != undefined && isString(users))
      users=users.split(",");
   if($("#" + name).length > 0) {
            $("#" + name).remove();
    }
   
    if(users.length > 0)
     {
        var table = $('<table id =' + name + '></table>').addClass("table-bordered table");
        row = $('<tr></tr>').addClass("alert-info");;
        row.append($('<th></th>').text("Shared with"));
        table.append(row);
        for (var i=0; i<users.length;i++){
                row=$('<tr></tr>');
                row.append($('<td></td>').text(users[i]));   
                table.append(row);
        }
        $('#shareDiv').append(table);
      }       
}
function share(id,email){
  var sharedWith=$('#autocomplete').val();
  if (sharedWith.trim().length>0){
   
  var parameters={sharedWith:sharedWith,id1:id,sharedCodeEmail:email};
    $.post(host+'shareCode',parameters, function(data) {
       location.reload();
      
    });}
}
function reload(cid,id){
  var show = $('#show');
    if (show.is(":checked"))
      location.href=host+"summary/submission/"+cid+"/"+id+"/true"
    else
     location.href=host+"summary/submission/"+cid+"/"+id+"/false"  
}

function createFiles(files){
   var name="fileTable";
   if(isString(files))
      files=files.split(",");
   if($("#" + name).length > 0) {
            $("#" + name).remove();
    }
    if(files.length > 0)
     {
        var table = $('<table id =' + name + '></table>').addClass("table-bordered table");
        row = $('<tr></tr>').addClass("alert-info");;
        row.append($('<th></th>').text("File Name"));
        table.append(row);
        for (var i=0; i<files.length;i++){
                row=$('<tr></tr>');
                row.append($('<td></td>').text(files[i]));   
                table.append(row);
        }
        $('#files').append(table);
      }       
}

function test(id1,student,classname) {
    var code=$('#code2').val();
    test3(id1);
    $('#tabs a[href="#result"]').tab('show');
    var parameters={code:code,id1:id1,student:student,classname:classname};
    $.post(host+'runjavacode',parameters, function(data) {
        if (data.result.trim().length==0)
            $('textarea[name=result]').val("Program Result");
        else
            $('textarea[name=result]').val(data.result);
        name="testTable";
        if($("#" + name).length > 0) {
            $("#" + name).remove();
        }

        if(data.test.length > 0) {
            var table = $('<table id =' + name + '></table>').addClass("table-bordered table");
            row = $('<tr></tr>').addClass("badge-warning");
            row.append($('<th></th>').text("parameters"));
            row.append( $('<th></th>').text("expected"));
            row.append( $('<th></th>').text("result"));
            row.append($('<th></th>').text("match"));
            row.append($('<th></th>').text("comment"));
            table.append(row);
            for (var i=0; i<data.test.length-4;i=i+4){
                if(data.test[i+3]=='false')
                    row=$('<tr></tr>').addClass("alert-danger");
                else
                    row=$('<tr></tr>').addClass("success");
                for( var n=0;n<4;n++){
                    row.append($('<td></td>').html(data.test[i+n].replace(/\n/g, "<br />")));
                    if (n==3){
                      if(data.test[i+3]=='false'){
                        if(data.test[i+1].indexOf("\n")>-1 && data.test[i+2].indexOf("\n")<0)
                          row.append($('<td></td>').text( " [expected contains \\n] at the end "));
                        else if (data.test[i+1].indexOf("\n")<0 && data.test[i+2].indexOf("\n")>-1)
                           row.append($('<td></td>').text( " [expected does not contains \\n] at the end "));
                        else if (data.test[i+1].charAt(data.test[i+1].length-1)==" " && data.test[i+2].charAt(data.test[i+2].length-1)!=" ")
                          row.append($('<td></td>').text( " [[expected contains]] \"\" at the end"));
                        else if (data.test[i+1].charAt(data.test[i+1].length-1)!=" " && data.test[i+2].charAt(data.test[i+2].length-1)==" ")
                          row.append($('<td></td>').text( " [[expected does not contains]] \"\" at the end"));
                        else
                          row.append($('<td></td>').text(" not the same")); 
                      }
                      else row.append($('<td></td>').text(""));
                    }
                      
                    
                }
                table.append(row);
            }
                 row = $('<tr></tr>').addClass("badge-warning");
                 row.append($('<td colspan="5"></td>').text(data.test[data.test.length-1]));
                 if ((data.test[data.test.length-1])== ("All Tests Passed")){
                     var parameters={pid:id1,hashvalue:data.hashvalue,solution:code,stderr:data.stderr,stdout:data.stdout,student:student,seed:data.seed,hashtest:data.hashtest};
                  $.post(host+'addproblemcomplete',parameters, function(data) {
                     $.post(host+'addtestpassed',{sid:data.sid}, function(data) {
                    
                  });
                  });
                 }
                 table.append(row);
                $('#testr').append(table);

        }
    },'json');
}

// add feedback method
function test2(id1) {
    var checked = false;
    var code1=$('#code2').val();
   
    var radios = document.getElementsByName('goodness');
    for (var i = 0, radio; radio = radios[i]; i++) {
        if (radio.checked) {
            test3(id1);
            checked = true;
            var selected = $("input[type='radio'][name='goodness']:checked");
             var parameters={pid:id1,feedback:selected.val(),code1:code1};
                      $.post(host+'addfeedback',parameters, function(data) {
                         $.post(host+'submit',parameters, function(data){
                        location.href=host+'homeworks';
                      });
                      });    

        }
    }
    if (!checked) {
        alert("Please select one feedback");
        radios.focus();
       
    }
}

// method to delete a problem 
function delete1(id){
   var parameters={id1:id};
    $.post(host+'problems/delete',parameters, function(data) {
      
                      location.reload();
                      });
}
function deleteTA(email,classId){
 
   var parameters={email:email,classId:classId};
    $.post(host+'unenrollstudents',parameters, function(data) {
                      location.reload();
                      });
}

function deleteStudent(email,classId){
 
   var parameters={email:email,classId:classId};
    $.post(host+'unenrollstudents',parameters, function(data) {
                      location.reload();
                      });
}
function copy(id){
 
   var parameters={id1:id};
    $.post(host+'problems/copy',parameters, function(data) {
      
                      location.reload();
                      });
}
function updatehash(id){
 
   var parameters={id1:id};
    $.post(host+'updatehash',parameters, function(data) {
      
                      location.reload();
                      });
}
function copyExcersise(id){
 
   var parameters={id1:id};
    $.post(host+'problems/copyExcersise',parameters, function(data) {
      
                      location.reload();
                      });
}

function test3(id){
  var code=ace.edit("editor").getValue();
 
  var parameters={pid:id,solution:code,problemtype:"homework",cn:$('#classname').val()};
                      $.post(host+'saveproblem',parameters, function(data) {
                       
                      });
}
function saveJavaIDE(user){
  var code=ace.edit("editor").getValue();
  var cn=$('#cn').val();
  var parameters={code:code,cn:cn};
   $.post(host+'saveJavaIDE',parameters, function(data) {
                       
                      });
}
function test4(id,student,user){
  var cn=$('#cn').val();
  var code=ace.edit("editor").getValue();
  if (student==user){
  var parameters={pid:id,solution:code,cn:cn,student:student};
                      $.post(host+'saveproblem',parameters, function(data) {
                         
                         update_user_problems(id,student,user);
                      });}
}

function update_user_problems(id,student,user){
  var cn=$('#cn').val();
  var code=ace.edit("editor").getValue();
  if (student==user){
  var parameters={pid:id,solution:code,cn:cn,student:student};
                      $.post(host+'update_user_problems',parameters, function(data) {
                        console.log(code);
                      });}
}
function test9(id,student,user){
 //alert("leaving the page");
}

