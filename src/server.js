const sql = require("mssql")
const express = require("express")
const app = express()
const hb = require('hbs');
const moment = require("moment");
const nodemailer = require("nodemailer")
const mailGun = require("nodemailer-mailgun-transport")
const { type } = require("express/lib/response");
const session = require("express-session")

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false
}))

hb.registerHelper('dateFormat', function (date, options) {
    const formatToUse = (arguments[1] && arguments[1].hash && arguments[1].hash.format) || "DD/MM/YYYY"
    return moment(date).format(formatToUse);
});

function parseDate(input) {
    var parts = input.match(/(\d+)/g);
    // new Date(year, month [, date [, hours[, minutes[, seconds[, ms]]]]])
    return new Date(parts[0], parts[1]-1, parts[2]); // months are 0-based
  }

hb.registerHelper('rh', function(context,options){
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    var day1 = today.getTime()
    var day2 = context.getTime()
    var diff = day2 - day1
    days = diff/(1000*3600*24)
    if(days>2){
        return new hb.SafeString(`<td><img src="https://bit.ly/3fkIoMA" width="24" height="24"/></td>`);
    }
    else if(days>1 && days<=2){
        return new hb.SafeString(`<td><img src="https://upload.wikimedia.org/wikipedia/en/thumb/f/fb/Yellow_icon.svg/1024px-Yellow_icon.svg.png" width="24" height="24"/></td>`);
    }
    else if(days>0 && days<=1){
        return new hb.SafeString(`<td><img src="https://img.icons8.com/emoji/48/000000/red-circle-emoji.png" width="30" height="30"/></td>`);
    }
    else if(days<=0){
        return new hb.SafeString(`<td><img src="https://img.icons8.com/ios-glyphs/30/000000/filled-circle.png" width="30" height="30"/></td>`);
    }
})
app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.set('view engine', 'hbs')
app.set('views', __dirname+ '/views')

app.get('/',(req,res)=>{
    // res.sendFile(__dirname+'/views/landingpg.html')
    res.render('loginpg')
})

app.get('/login',(req,res)=>{
    res.render('loginpg')
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
    if(req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        var units = await sql.query`select * from UnitMaster`
        var depts = await sql.query`select * from DeptMaster` 
        units=units.recordset
        depts=depts.recordset
        res.render('admin/signup',{
            units, depts,
            username:req.session.details[0].UserName
        })
    }
})

app.post('/registeruser',async(req,res)=>{
    if(req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        var r = req.body
        await sql.query`insert into UserMaster (PasswordHash,EmailId,Phone,UserName,DeptId,UnitId,UserType) values (HASHBYTES('SHA2_512',${r.passwd}),${r.email},${r.phoneno},${r.Name},${r.depts},${r.units},${r.usertype})`
        res.redirect('/compsrecvdpg')
    }
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
        sess = req.session
        sess.d = d
        sess.details = details
        sess.usertype=details[0].UserType
        if(details[0].UserType == 'ITinfrastructure'){
            sess.it=true
            res.redirect('/pendingcomplaints')
        }
        else if(details[0].UserType == 'Admin' || details[0].UserType == 'Superuser'){
            res.redirect('/compsrecvdpg')
        }
        else{
            sess.it=false
            res.redirect('/complaintpg')
        }
    }
})

app.get('/complaintpg',(req,res)=>{
    if(req.session.d && req.session.details){
        d=req.session.d
        details=req.session.details
        var username = req.session.details[0].UserName
        res.render('enduser/complaintpg',{
            d,details,username
        })
    }
    else{
        res.render('loginpg')
    }
})

app.get('/authorize',async(req,res)=>{
    if(req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        users = await sql.query`select * from UserMaster`
        units = await sql.query`select * from UnitMaster`
        auths = await sql.query`select * from UserAuth`
        users=users.recordset; units=units.recordset; auths=auths.recordset;
        res.render('admin/userauth',{
            users,units,auths,
            username:req.session.details[0].UserName
        })
    }
})

app.post('/authorizeuser',async(req,res)=>{
    if(req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        var data = req.body
        await sql.query`insert into UserAuth (UserID,UnitID,StartDate,EndDate) values (${data.userid},${data.unitid},${data.startdate},${data.enddate})`
        res.redirect("authorize")
    }
})

app.get('/assetassign',async(req,res)=>{
    if(req.session.details[0].UserType=='ITinfrastructure' || req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        var assets = await sql.query`select * from AssetMaster where AssetID not in (select AssetID from AssetAssignment)`
        var users = await sql.query`select * from UserMaster`
        assets = assets.recordset; users = users.recordset;
        var it=false
        if(req.session.details[0].UserType=='ITinfrastructure'){
            var username = req.session.details[0].UserName
            res.render('it/assetassign',{
                assets,users,it,username
            })
        }
        else{
            var username = req.session.details[0].UserName
            res.render('admin/assetassign',{
                assets,users,it,username
            })
        }
    }
    else{
        res.render('loginpg')
    }
})
app.post('/assign',async(req,res)=>{
    var d = req.body;
    await sql.query`insert into AssetAssignment (AssetID,UserID,StartDate,EndDate,CreatedBy,CreatedDate,CreatedIT) values
    (${d.asset},${d.user},${d.startdate},${d.enddate},'admin',getdate(),'desktop999')`
    res.redirect('/assetassign')
})
app.get('/addasset',async(req,res)=>{
    if(req.session.details[0].UserType=='ITinfrastructure' || req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        var locs = await sql.query`select * from LocationMaster`
        var depts = await sql.query`select * from DeptMaster`
        var brands = await sql.query`select * from BrandMaster`
        var types = await sql.query`select * from AssetType`
        locs = locs.recordset; depts=depts.recordset; brands = brands.recordset; types=types.recordset
        var it=false
        if(req.session.details[0].UserType=='ITinfrastructure'){
            var username = req.session.details[0].UserName
            res.render('it/addasset',{
                locs,depts,brands,types,it,username
            })
        }
        else{
            var username = req.session.details[0].UserName
            res.render('admin/addasset',{
                locs,depts,brands,types,it,username
            })
        }
        
    }
    else{
        res.render('loginpg')
    }
})
app.post('/assetadd',async(req,res)=>{
    var d = req.body
    await sql.query`insert into AssetMaster (AssetDesc,Model,SerialNo,TypeID,BrandID,LocationID,DeptID,PurchaseDate,AssetNo,Qty,FlagID)
    values (${d.specs},${d.model},${d.serialno},${d.type},${d.brand},${d.location},${d.depts},${d.purchasedate},${d.assetno},${d.qty},${d.condition})`
    res.redirect('/assetlist')
})

app.get('/addlocation',async(req,res)=>{
    if(req.session.details[0].UserType=='ITinfrastructure' || req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        var locs = await sql.query`select * from LocationMaster`
        locs = locs.recordset
        var it=false
        if(req.session.details[0].UserType=='ITinfrastructure'){
            var username = req.session.details[0].UserName
            res.render('it/addlocation',{
                locs,it,username
            })
        }
        else{
            var username = req.session.details[0].UserName
            res.render('admin/addlocation',{
                locs,it,username
            })
        }
    }
    else{
        res.render('loginpg')
    }
})
app.get('/assettype',async(req,res)=>{
    if(req.session.details[0].UserType=='ITinfrastructure' || req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        var types = await sql.query`select * from AssetType`
        types = types.recordset
        var it=false
        if(req.session.details[0].UserType=='ITinfrastructure'){
            var username = req.session.details[0].UserName
            res.render('it/assettype',{
                types,it,username
            })
        }
        else{
            var username = req.session.details[0].UserName
            res.render('admin/assettype',{
                types,it,username
            })
        }
    }
    else{
        res.render('loginpg')
    }
})
app.get('/assetbrand',async(req,res)=>{
    if(req.session.details[0].UserType=='ITinfrastructure' || req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        var brands = await sql.query`select * from BrandMaster`
        brands = brands.recordset
        var it=false
        if(req.session.details[0].UserType=='ITinfrastructure'){
            var username = req.session.details[0].UserName
            res.render('it/addbrand',{
                brands,it,username
            })
        }
        else{
            var username = req.session.details[0].UserName
            res.render('admin/addbrand',{
                brands,it,username
            })
        }
    }
    else{
        res.render('loginpg')
    }
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
    if(req.session.details[0].UserType=='ITinfrastructure' || req.session.details[0].UserType=='Admin' || req.session.details[0].UserType=='Superuser'){
        var assetlist = await sql.query`select * from AssetMaster`
        assetlist=assetlist.recordset
        var it=false
        if(req.session.details[0].UserType=='ITinfrastructure')
        {
            var username = req.session.details[0].UserName
            res.render('it/assetlist',{
                assetlist,it,username
            })
        }
        else{
            var username = req.session.details[0].UserName
            res.render('admin/assetlist',{
                assetlist,it,username
            })
        }
    }
    else{
        res.render('loginpg')
    }
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
    //send complaints to admin
    if(req.session.details && req.session.usertype=='Enduser'){
        var data = req.body
        const email = data.email
        await sql.query`insert into Complaint (AssetID,UserID,CloseDate,ComplaintDesc) values (${data.asset},${data.userid},DATEADD(DAY,3,getdate()),${data.complaint})`
        var mail = `
        <h1>AssetID: ${data.asset}</h1>
        <h1>Complaint-</h1>
        <br>
        <p>${data.complaint}</p>
        `

        const auth = {
            auth:{
                domain: '', // generated ethereal user
                api_key: '', // generated ethereal password
            }
        };
        const transporter = nodemailer.createTransport(mailGun(auth));

        // send mail with defined transport object
        transporter.sendMail({
            from: email, // sender address
            to: "guptaashim29@gmail.com", // list of receivers
            subject: "Complaint", // Subject line
            text: "Hello world?", // plain text body
            html: mail, // html body
        });
        res.redirect('/filedcomplaints')
    }
    else{
        res.render('loginpg')
    }
})

app.get('/filedcomplaints',async(req,res)=>{
    if(req.session.details && req.session.usertype=='Enduser'){
        var complaints = await sql.query`select * from Complaint where UserID=${req.session.details[0].UserID}`
        complaints = complaints.recordset
        res.render('enduser/filedcomplaints',{
            complaints,
            username:req.session.details[0].UserName
        })
    }
})

app.get('/pendingcomplaints',async(req,res)=>{
    if(req.session.details){
        var complaints = await sql.query`select * from Complaint where UserID=${req.session.details[0].UserID}`
        var allcomps= await sql.query`select * from Complaint order by CloseDate ASC`
        complaints = complaints.recordset
        allcomps=allcomps.recordset
        var username=req.session.details[0].UserName
        if(req.session.details[0].UserType=='ITinfrastructure'){
            var complaints = await sql.query`select * from AssignedComplaints where AssignedTo=${req.session.details[0].UserID} order by CloseDate ASC`
            complaints = complaints.recordset
            res.render('it/pendingcomplaints',{
                complaints,username
            })
        }
        else{
            complaints = await sql.query`select * from AssignedComplaints where UserID=${req.session.details[0].UserID}`
            complaints=complaints.recordset
            res.render('enduser/pendingcomplaints',{
                complaints,username
            })
        }
            
    }
    else{
        res.render('loginpg')
    }
})

app.get('/logout',(req,res)=>{
    req.session.destroy((err)=>{
        if(err){
            console.log(err)
        }
        res.render('loginpg')
    })

})

app.post('/reopen',async(req,res)=>{
    if(req.session.details[0].UserType=='Enduser'){
        var d = req.body
        var comp = await sql.query`select * from ClosedComplaints where CloseComplaintID = ${d.id}`
        comp = comp.recordset
        //add to assigned complaints table
        await sql.query`insert into AssignedComplaints (AssignedBy,AssignedTo,ReopenedTimes,AssetID,UserID,CloseDate,ComplaintDesc)
    values (${comp[0].AssignedBy},${comp[0].AssignedTo},${comp[0].ReopenedTimes+1},${comp[0].AssetID},${comp[0].ComplainersUserID},DATEADD(DAY,3,getdate()),${d.remarks})`

        //remove from closed table
        await sql.query`delete from ClosedComplaints where CloseComplaintID=${d.id}`

        //add to reopened table
        await sql.query`insert into ComplaintsReopened(ComplainersUserID,AssetID,ComplaintDesc,AssignedCloseDate,Remarks,ReopenReason,AssignedBy,AssignedTo,ReopenedTimes)
        values (${comp[0].ComplainersUserID},${comp[0].AssetID},${comp[0].ComplaintDesc},${comp[0].AssignedCloseDate},${comp[0].Remarks},${d.remarks},${comp[0].AssignedBy},${comp[0].AssignedTo},${comp[0].ReopenedTimes+1})`
        res.redirect('/pendingcomplaints')
   }
})

app.get('/complaintsreopened',async(req,res)=>{
    if(req.session.usertype=='Admin' || req.session.usertype=='ITinfrastructure'){
        var complaints = await sql.query`select * from ComplaintsReopened where AssignedBy=${req.session.details[0].UserID}`
        complaints=complaints.recordset
        if(req.session.usertype=='Admin'){
            res.render('admin/compsreopened',{
                complaints,
                username:req.session.details[0].UserName
            })
        }
        else if(req.session.usertype=='ITinfrastructure'){
            complaints = await sql.query`select * from ComplaintsReopened where AssignedTo=${req.session.details[0].UserID}`
            complaints=complaints.recordset
            res.render('it/reopenedcomps',{
                complaints,
                username:req.session.details[0].UserName
            })
        }
    }
})

app.get('/editclosedatepg',async(req,res)=>{
    if(req.session.details){
        var cid = req.query.id
        var username=req.session.details[0].UserName
        res.render('it/editclosedatepg',{
            cid,username
        })
    }
    else{
        res.render('loginpg')
    }
})

app.post('/editclosedate',async(req,res)=>{
    if(req.session.details){
        var data = req.body
        await sql.query`update AssignedComplaints set CloseDate=${data.closedate} where AssignedComplaintsID=${data.cid}`
        var mail = `
            <h1>ComplaintID: ${data.cid}</h1>
            <h3>Explaination-</h3>
            <p>${data.explaination}</p>
            `

            const auth = {
                auth:{
                    domain: '', // generated ethereal user
                    api_key: '', // generated ethereal password
                }
            };
            const transporter = nodemailer.createTransport(mailGun(auth));

            // send mail with defined transport object
            transporter.sendMail({
                from: "it@gmail.com", // sender address
                to: "guptaashim29@gmail.com", // list of receivers
                subject: "Close Date Changed", // Subject line
                text: "Hello world?", // plain text body
                html: mail, // html body
            });
            res.redirect("/pendingcomplaints")
    }
    else{
        res.render('loginpg')
    }
})

app.get('/closecomplaintpg',async(req,res)=>{
    if(req.session.details){
        var cid = req.query.id
        var data = await sql.query`select * from AssignedComplaints where AssignedComplaintsID=${cid}`
        ClosersID = req.session.details[0].UserID
        data = data.recordset
        data[0].ClosersID=ClosersID
        var username = req.session.details[0].UserName
        res.render('it/closecomplaintpg',{
            data,username
        })
    }
    else{
        res.render('loginpg')
    }
})

app.post('/closecomplaint',async(req,res)=>{
    if(req.session.details){
        var data = req.body
        //add complaint to closeComplaint table
        await sql.query`insert into ClosedComplaints (ClosersUserID,ComplainersUserID,AssetID,ComplaintDesc,CloseDate,AssignedCloseDate,Remarks,AssignedBy,AssignedTo,ReopenedTimes)
        values (${data.ClosersUserID},${data.ComplainersUserID},${data.AssetID},${data.ComplaintDesc},getdate(),${data.AssignedCloseDate},${data.remarks},${data.AssignedBy},${data.AssignedTo},${data.ReopenedTimes})`
        //remove from Complaint table query
        await sql.query`delete from AssignedComplaints where AssignedComplaintsID = ${data.ComplaintID}`
        //send mail
        var mail = `
            <h1>ComplaintID: ${data.ComplaintID}</h1>
            <h3>Remarks-</h3>
            <p>${data.remarks}</p>
            `

            const auth = {
                auth:{
                    domain: '', // generated ethereal user
                    api_key: '', // generated ethereal password
                }
            };
            const transporter = nodemailer.createTransport(mailGun(auth));

            // send mail with defined transport object
            transporter.sendMail({
                from: `${req.session.details[0].EmailId}`, // sender address
                to: "guptaashim29@gmail.com", // list of receivers
                subject: "Complaint Resolved", // Subject line
                text: "Hello world?", // plain text body
                html: mail, // html body
            });
            res.redirect("/pendingcomplaints")
    }
    else{
        res.render('loginpg')
    }
})

app.get('/closedcomplaints',async(req,res)=>{
    if(req.session.details){
        var complaints
        if(req.session.usertype=="ITinfrastructure"){
            complaints = await sql.query`select * from ClosedComplaints where ClosersUserID=${req.session.details[0].UserID}`
            complaints=complaints.recordset
            var username = req.session.details[0].UserName
            res.render('it/closedcomplaints',{
                complaints,username
            })
        }
        else if(req.session.usertype=="Enduser"){
            complaints = await sql.query`select * from ClosedComplaints where ComplainersUserID=${req.session.details[0].UserID}`
            complaints=complaints.recordset
            var username = req.session.details[0].UserName
            res.render('enduser/closedcomplaints',{
                complaints,username
            })
        }
        else{
            complaints= await sql.query`select * from ClosedComplaints`
            complaints=complaints.recordset
            var username = req.session.details[0].UserName
            res.render('admin/compsclosed',{
            complaints,username
            })
        }
        
    }
    else{
        res.render('loginpg')
    }
})

app.get("/reopenpg",(req,res)=>{
    if(req.session.details && req.session.usertype=="Enduser"){
        var username = req.session.details[0].UserName
        res.render('enduser/reopenpg',{
            username,
            id: req.query.id
        })
    }
})



app.get('/compsrecvdpg',async(req,res)=>{
    if(req.session.details && (req.session.details[0].UserType=="Admin" || req.session.details[0].UserType=="Superuser")){
        complaints = await sql.query`select * from Complaint`
        complaints = complaints.recordset
        res.render('admin/compsrecvd',{
            complaints,
            username: req.session.details[0].UserName
        })
    }
})

app.get('/assignpg',async(req,res)=>{
    if(req.session.details && (req.session.details[0].UserType=="Admin" || req.session.details[0].UserType=="Superuser")){
        var id = req.query
        var itpeople = await sql.query`select * from UserMaster where UserType='ITinfrastructure'`
        itpeople=itpeople.recordset
        res.render('admin/assignpg',{
            id,itpeople,
            username:req.session.details[0].UserName
        })
    }
})

app.post('/assignit',async(req,res)=>{
    if(req.session.details && (req.session.details[0].UserType=="Admin" || req.session.details[0].UserType=="Superuser")){
        var data = req.body
        var comp = await sql.query`select * from Complaint where ComplaintID=${data.ComplaintID}`
        comp=comp.recordset
        await sql.query`insert into AssignedComplaints (AssignedBy,AssignedTo,ReopenedTimes,AssetID,UserID,CloseDate,ComplaintDesc)
        values (${req.session.details[0].UserID},${data.it},0,${comp[0].AssetID},${comp[0].UserID},${comp[0].CloseDate},${comp[0].ComplaintDesc})`
        await sql.query`delete from Complaint where ComplaintID=${data.ComplaintID}`
        res.redirect('/compsassignedpg')
    }
})

app.get('/compsassignedpg',async(req,res)=>{
    if(req.session.details && (req.session.details[0].UserType=="Admin" || req.session.details[0].UserType=="Superuser")){
        var complaints = await sql.query`select * from AssignedComplaints where AssignedBy=${req.session.details[0].UserID}`
        complaints=complaints.recordset
        res.render('admin/compsassigned',{
            complaints,
            username:req.session.details[0].UserName
        })
    }
})