const sql = require("mssql")
const express = require("express")
const app = express()
const hb = require('hbs');
const moment = require("moment");
const { type } = require("express/lib/response");

hb.registerHelper('dateFormat', function (date, options) {
    const formatToUse = (arguments[1] && arguments[1].hash && arguments[1].hash.format) || "DD/MM/YYYY"
    return moment(date).format(formatToUse);
});
app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.set('view engine', 'hbs')
app.set('views', __dirname+ '/views')

app.get('/',(req,res)=>{
    res.sendFile(__dirname+'/views/landingpg.html')
})

app.get('/login',(req,res)=>{
    res.sendFile(__dirname + '/views/loginpg.html')
})

const dbconfig={
    server: "localhost\\SQLEXPRESS",
    user: "myuser",
    password: "mypass",
    database: "CMS",
    port: 1433,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      },
      options: {
        encrypt: true, 
        trustServerCertificate: true 
      }
}

app.listen(8000,async(req,res)=>{
    try{
        await sql.connect(dbconfig)
        console.log("server started at 127.0.0.1:8000")
    }
    catch(err){
        console.log(err)
    }
})

app.get('/signup',async(req,res)=>{
    var units = await sql.query`select * from UnitMaster`
    var depts = await sql.query`select * from DeptMaster`
    units=units.recordset
    depts=depts.recordset
    res.render('signuppg',{
        units, depts
    })
})

app.post('/registeruser',async(req,res)=>{
    var r = req.body
    await sql.query`insert into UserMaster (PasswordHash,EmailId,Phone,UserName,DeptId,UnitId) values (HASHBYTES('SHA2_512',${r.passwd}),${r.email},${r.phoneno},${r.Name},${r.depts},${r.units})`
    res.sendFile(__dirname + '/views/loginpg.html')
})


app.post('/loginuser',async(req,res)=>{
    var data = req.body
    let details = await sql.query`select * from UserMaster where EmailId=${data.email} and PasswordHash=HASHBYTES('SHA2_512',${data.passwd})`
    details=details.recordset
    if(details==''){
        res.send('login unsuccessful')
    }
    else{
        res.send('login successful')
    }
})

app.get('/authorize',async(req,res)=>{
    users = await sql.query`select * from UserMaster`
    units = await sql.query`select * from UnitMaster`
    auths = await sql.query`select * from UserAuth`
    users=users.recordset; units=units.recordset; auths=auths.recordset;
    res.render('authorize',{
        users,units,auths
    })
})

app.post('/authorizeuser',async(req,res)=>{
    var data = req.body
    await sql.query`insert into UserAuth (UserID,UnitID,StartDate,EndDate) values (${data.userid},${data.unitid},${data.startdate},${data.enddate})`
    res.send("authrization given")
})

app.get('/assetassign',async(req,res)=>{
    var assets = await sql.query`select * from AssetMaster`
    var users = await sql.query`select * from UserMaster`
    assets = assets.recordset; users = users.recordset;
    res.render('assetassign',{
        assets,users
    })
})
app.post('/assign',async(req,res)=>{
    var d = req.body;
    await sql.query`insert into AssetAssignment (AssetID,UserID,StartDate,EndDate,CreatedBy,CreatedDate,CreatedIT) values
    (${d.asset},${d.user},${d.startdate},${d.enddate},'admin',getdate(),'desktop999')`
    res.send("asset assigned")
})
app.get('/addasset',async(req,res)=>{
    var locs = await sql.query`select * from LocationMaster`
    var depts = await sql.query`select * from DeptMaster`
    var brands = await sql.query`select * from BrandMaster`
    var types = await sql.query`select * from AssetType`
    locs = locs.recordset; depts=depts.recordset; brands = brands.recordset; types=types.recordset
    res.render('addasset',{
        locs,depts,brands,types
    })
})
app.post('/assetadd',async(req,res)=>{
    var d = req.body
    await sql.query`insert into AssetMaster (AssetDesc,Model,SerialNo,TypeID,BrandID,LocationID,DeptID,PurchaseDate,AssetNo,Qty,FlagID)
    values (${d.specs},${d.model},${d.serialno},${d.type},${d.brand},${d.location},${d.depts},${d.purchasedate},${d.assetno},${d.qty},${d.condition})`
    res.send("Asset Added")
})

app.get('/addlocation',async(req,res)=>{
   var locs = await sql.query`select * from LocationMaster`
   locs = locs.recordset
   res.render('addlocation',{
       locs
   })
})
app.get('/assettype',async(req,res)=>{
    var types = await sql.query`select * from AssetType`
    types = types.recordset
    res.render('assettype',{
        types
    })
})
app.get('/assetbrand',async(req,res)=>{
    var brands = await sql.query`select * from BrandMaster`
    brands = brands.recordset
    res.render('addbrand',{
        brands
    })
})
app.post('/addloc',async(req,res)=>{
    var data = req.body
    await sql.query`insert into LocationMaster(LocationDesc) values (${data.location})`
    var locs = await sql.query`select * from LocationMaster`
   locs = locs.recordset
   res.render('addlocation',{
       locs
   })
})
app.post('/addtype',async(req,res)=>{
    var data = req.body
    await sql.query`insert into AssetType(TypeDesc) values (${data.type})`
    var types = await sql.query`select * from AssetType`
    types = types.recordset
    res.render('assettype',{
        types
    })
})
app.post('/addbrand',async(req,res)=>{
    var data = req.body
    await sql.query`insert into BrandMaster(BrandDesc) values (${data.brand})`
    var brands = await sql.query`select * from BrandMaster`
    brands = brands.recordset
    res.render('addbrand',{
        brands
    })
})



