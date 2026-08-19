/* Presentation-only transforms shared by tabletop game consumers. */
(function installTabletopPerspective(root){
  const quarter=value=>((Number(value)||0)%4+4)%4;
  function squareCell(size,row,col,turns){
    const n=Math.max(1,Number(size)||1),r=Number(row),c=Number(col);
    switch(quarter(turns)){case 1:return[c,n-1-r];case 2:return[n-1-r,n-1-c];case 3:return[n-1-c,r];default:return[r,c];}
  }
  function quarterPoint(size,x,y,turns){
    const s=Math.max(1,Number(size)||1),cx=s/2,cy=s/2,dx=Number(x)-cx,dy=Number(y)-cy;
    switch(quarter(turns)){case 1:return[cx-dy,cy+dx];case 2:return[cx-dx,cy-dy];case 3:return[cx+dy,cy-dx];default:return[Number(x),Number(y)];}
  }
  function nearQuarterTurns(pid){const value=Number(pid);return Number.isInteger(value)&&value>=0&&value<=3?(3-value+4)%4:0;}
  root.TabletopPerspective=Object.freeze({squareCell,quarterPoint,nearQuarterTurns});
})(typeof globalThis!=='undefined'?globalThis:this);
