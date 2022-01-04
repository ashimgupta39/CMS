const sql = require("mssql")
const express = require("express")
const app = express()
const hb = require('hbs');
const moment = require("moment");
const nodemailer = require("nodemailer")
const mailGun = require("nodemailer-mailgun-transport")
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
    var details = await sql.query`select * from UserMaster where EmailId=${data.email} and PasswordHash=HASHBYTES('SHA2_512',${data.passwd})`
    details=details.recordset
    if(details==''){
        res.send('login unsuccessful')
    }
    else{
        var d = await sql.query`select * from AssetMaster where AssetID in (select AssetID from AssetAssignment where UserID=${details[0].UserID})`
        d=d.recordset
        res.render('complaintpg',{
            d,details
        })
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
    var assets = await sql.query`select * from AssetMaster where AssetID not in (select AssetID from AssetAssignment)`
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
    res.redirect('/assetassign')
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
    res.redirect('/assetlist')
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
    res.redirect('/addlocations')
})
app.post('/addtype',async(req,res)=>{
    var data = req.body
    await sql.query`insert into AssetType(TypeDesc) values (${data.type})`
    res.redirect('/assettype')
})
app.post('/addbrand',async(req,res)=>{
    var data = req.body
    await sql.query`insert into BrandMaster(BrandDesc) values (${data.brand})`
    res.redirect('/assetbrand')
})

app.get('/assetlist',async(req,res)=>{
    var assetlist = await sql.query`select * from AssetMaster`
    assetlist=assetlist.recordset
    res.render('AssetList',{
        assetlist
    })
})

app.get('/delete',async(req,res)=>{
    var AssetID = req.query.id
    await sql.query`delete from AssetAssignment where AssetID=${AssetID}`
    await sql.query`delete from AssetMaster where AssetID=${AssetID}`
    res.redirect('/assetlist')
})

app.get('/edit',async(req,res)=>{
    var locs = await sql.query`select * from LocationMaster`
    var depts = await sql.query`select * from DeptMaster`
    var brands = await sql.query`select * from BrandMaster`
    var types = await sql.query`select * from AssetType`
    locs = locs.recordset; depts=depts.recordset; brands = brands.recordset; types=types.recordset
    var AssetID = req.query.id
    var asset = await sql.query`select * from AssetMaster where AssetID=${AssetID}`
    asset=asset.recordset
    res.render('editpg',{
        asset,locs,depts,brands,types
    })
})

app.post('/assetedit',async(req,res)=>{
    var d = req.body
    await sql.query`update AssetMaster set AssetDesc=${d.specs},Model=${d.model},SerialNo=${d.serialno},TypeID=${d.type},BrandID=${d.brand},LocationID=${d.location},DeptID=${d.depts},PurchaseDate=${d.purchasedate},AssetNo=${d.assetno},Qty=${d.qty},FlagID=${d.condition} where AssetID=${d.assetid}`
    res.redirect('/assetlist')
})

app.post('/complaint',async(req,res)=>{
    var data = req.body
    const email = data.email
    await sql.query`insert into Complaint (AssetID,ComplaintDesc) values (${data.asset},${data.complaint})`
    var mail = `
    <h1>AssetID: ${data.asset}</h1>
    <h1>Complaint-</h1>
    <br>
    <p>${data.complaint}</p>
    `

    const auth = {
        auth:{
            domain: 'sandbox656ed740c41e43c6b33ea72dc214500c.mailgun.org', // generated ethereal user
            api_key: 'fb85c0e78751e45c3fd74c5f6984bdd7-0be3b63b-14706682', // generated ethereal password
        }
    };
    const transporter = nodemailer.createTransport(mailGun(auth));

    // send mail with defined transport object
    transporter.sendMail({
        from: email, // sender address
        to: "agupta34_be19@thapar.edu", // list of receivers
        subject: "Complaint", // Subject line
        text: "Hello world?", // plain text body
        html: mail, // html body
    });
    res.send("complaint sent")
})