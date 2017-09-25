


/* only do all this when document has finished loading (needed for RaphaelJS) */
 function makegraph(node1,node2,result){
    var redraw, g, renderer;
    var width = $(document).width() - 20;
    var height = $(document).height() - 60;
    g = new Graph();
    // console.log("node " + node1.length);
   // alert(typeof(node1));
   // alert(node1.length);
    
       
    
    for( var n in node1){
        if (node2[n]!=" ")
        g.addEdge("node"+n, "node"+(Number(n)+1), { directed : true ,stroke : "#bfa" , fill : "#56f",label:result[node1[n]+"__>"+node2[n]]} );
        else 
        g.addNode("node" +n);

    }
    /* connect nodes with edges */
   
    /* layout the graph using the Spring layout implementation */
    var layouter = new Graph.Layout.Spring(g);
    
    /* draw the graph using the RaphaelJS draw implementation */
    renderer = new Graph.Renderer.Raphael('canvas', g, width, height);
    
   
    //    console.log(g.nodes["kiwi"]);
};

