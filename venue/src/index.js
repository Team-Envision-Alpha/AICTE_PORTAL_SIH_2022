'use strict';
const express = require('express');
const uuid = require('uuid');
const { connectDB,db } = require('./db');
const { Response, alertProducer, logProducer } = require('./helpers');

// connect to aws keyspaces 
connectDB()

// connect to kafka producers 
async function connectProducers() {
    try{
        await alertProducer.connect();
        await logProducer.connect();
        console.log("producer_connected");
    }catch(err){
        console.log(err);
    }
}
connectProducers();

const app = express();

// parse req body as json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes for venues

// get all venues 
app.get('/venues', async (req, res) => {
    try {
        const {city} = req.query
        let data;
        if(city){
            const query = 'select * from aicte.venues where city = ?'
            data = (await db.execute(query,[city])).rows
        }else{
            const query = 'select * from aicte.venues'
            data = (await db.execute(query,[])).rows 
        }
        return res.status(200).json(Response(200, 'Success', data))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
})

// get venue 
app.get('/venues/:id', async (req, res) => {
    try {
        const query = 'select * from aicte.venues where id = ?'
        const data = (await db.execute(query,[req.params.id])).rows[0]
        return res.status(200).json(Response(200, 'Success', data))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
});


// register venue 
app.post('/venues', async (req, res) => {
    const user = JSON.parse(req.headers.user)
    const log = {
        type: 'venue_register',
        message:"",
        user_id: user.id,
        user_name: user.name,
    }
    try {
        let { name,email,phone,state,city,address,pincode,capacity,website,venue_head,image,canteen_menu,canteen_contact } = req.body
        if (!(name &&  email &&  phone && state && city && address && pincode && capacity && venue_head && image && canteen_menu&&canteen_contact)){
            return res.status(400).json(Response(400, 'Bad Request', 'Please fill all the fields'))
        }
        website = website ? website : ''
        const id = uuid.v4()
        const timestamp = new Date().toISOString()
        const save_venue = "insert into aicte.venues (id,name,email,phone,venue_head,state,city,address,pincode,capacity,website,canteen_menu,canteen_contact,createdat,updatedat,image) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        await db.execute(save_venue,[id,name,email,phone,venue_head,state,city,address,pincode,capacity,website,canteen_menu,canteen_contact,timestamp,timestamp,image])
        log.message = `${name} registered`
        res.json(Response(200, 'Success', { id, name,image, email, phone,venue_head,state, city, address, pincode, capacity, website,canteen_menu,canteen_contact, createdat:timestamp, updatedat:timestamp }))
    }
    catch (error) {
        // console.log(error);
        log.message = "error in registering venue"
        res.status(500).json(Response(500, 'Error', error))
    }
    // log to db using kafka producer
    await logProducer.send({
        topic: 'log',
        messages: [
            { value: JSON.stringify(log) }
        ]
    })
    return;
});

// update venue details
app.put('/venues/:id', async (req, res) => {
    const user = JSON.parse(req.headers.user)
    const log = {
        type: 'venue_update',
        message:"",
        user_id: user.id,
        user_name: user.name,
    }
    try {
        let { name,email,phone,state,city,address,pincode,capacity,website,venue_head,canteen_menu,canteen_contact,createdat } = req.body
        if (!(name &&  email &&  phone && state && city && address && pincode && capacity && venue_head && createdat&&canteen_menu&&canteen_contact)){
            return res.status(400).json(Response(400, 'Bad Request', 'Please fill all the fields'))
        }
        website = website ? website : ''
        const timestamp = new Date().toISOString()
        const update_venue = `update aicte.venues set name = ?,venue_head = ?,email = ?,phone = ?,state = ?,city = ?,address = ?,pincode = ?,capacity = ?,website = ?,canteen_menu = ?,canteen_contact = ?,updatedat = ? where id = ? and createdat = ?`
        await db.execute(update_venue,[name,venue_head,email,phone,state,city,address,pincode,capacity,website,canteen_menu,canteen_contact,timestamp,req.params.id,createdat])
        log.message = "venue updated with id "+req.params.id
        res.json(Response(200, 'Success', "Venue updated successfully"))
    }
    catch (error) {
        log.message = "error in updating venue with id "+req.params.id
        res.status(500).json(Response(500, 'Error', error))
    }
    // log to db using kafka producer
    await logProducer.send({
        topic: 'log',
        messages: [
            { value: JSON.stringify(log) }
        ]
    })
    return;
});

// delete venue
app.delete('/venues/:id', async (req, res) => {
    const user = JSON.parse(req.headers.user)
    const log = {
        type: 'venue_delete',
        message:"",
        user_id: user.id,
        user_name: user.name,
    }
    try {
        const delete_venue = `delete from aicte.venues where id = ?`
        await db.execute(delete_venue,[req.params.id])
        log.message = `venue deleted with id ${req.params.id}`
        res.json(Response(200, 'Success', "Venue deleted successfully"))
    }
    catch (error) {
        log.message = `error in deleting venue with id ${req.params.id}`
        res.status(500).json(Response(500, 'Error', error))
    }
    // log to db using kafka producer
    await logProducer.send({
        topic: 'log',
        messages: [
            { value: JSON.stringify(log) }
        ]
    })
    return;
})

// book a venue for event 
app.post('/venues/book',async(req,res)=>{
    const user = JSON.parse(req.headers.user)
    const log = {
        type: 'venue_book',
        message:"",
        user_id: user.id,
        user_name: user.name,
    }
    try {
        const {event_id,venue_id,venue_head,from_date,to_date,time} = req.body
        const status = 'requested'
        const id = uuid.v4()
        const timestamp = new Date().toISOString()
        const query = "insert into aicte.bookings (id,event_id,venue_id,venue_head,from_date,to_date,time,status,createdat,updatedat) values (?,?,?,?,?,?,?,?,?,?)"
        await db.execute(query,[id,event_id,venue_id,venue_head,from_date,to_date,time,status,timestamp,timestamp])
        log.message = `venue(${venue_id}) booked for event with id ${event_id}`
        const venue = (await db.execute(`select * from aicte.venues where id = ?`,[venue_id])).rows[0]
        const event = (await db.execute(`select * from aicte.events where id = ?`,[event_id])).rows[0]
        await alertProducer.send({
            topic: 'alert',
            messages: [{value: JSON.stringify({
                email: venue.email,
                subject:`${event.name} requested for booking ${venue.name}`,
                text:`${venue.name} has been requested for booking for "${event.name}" from ${from_date} to ${to_date} at ${time} please log on to portal to update status.`
            })}]
        })
        res.json(Response(200, 'Success', "Venue Requested for event"))
    } catch (error) {
        log.message = `error in booking venue with id ${req.params.id} for event with id ${req.params.id}`
        res.status(500).json(Response(500, 'Error', error))
    }
    // log to db using kafka producer
    await logProducer.send({
        topic: 'log',
        messages: [
            { value: JSON.stringify(log) }
        ]
    })
    return;
});

// update booking status 
app.put('/venues/book/status',async(req,res)=>{
    const user = JSON.parse(req.headers.user)
    const log = {
        type: 'venue_book',
        message:"",
        user_id: user.id,
        user_name: user.name,
    }
    try {
        const {status,id,createdat} = req.body
        const timestamp = new Date().toISOString()
        const query = "update aicte.bookings set status = ?,updatedat = ? where id = ?"
        await db.execute(query,[status,timestamp,id])
        // const query = "update aicte.bookings set status = ?,updatedat = ? where id = ? and createdat = ?"
        // await db.execute(query,[status,timestamp,id,createdat])
        const booking = (await db.execute('select * from aicte.bookings where id = ?',[id])).rows[0]
        const event = (await db.execute('select * from aicte.events where id = ?',[booking.event_id])).rows[0]
        const venue = (await db.execute('select * from aicte.venues where id = ?',[booking.venue_id])).rows[0]
        const event_org = (await db.execute('select * from aicte.users where id = ?',[event.organiser])).rows[0]
        // send status update mails 
        // if approved send food req to canteen manager of venue 
        if(status.toLowerCase()=='approved'){
            await alertProducer.send({
                topic: 'alert',
                messages: [{value: JSON.stringify({
                    email: venue.canteen_contact,
                    subject:`Food requirements for ${event.name}`,
                    text:`Here is the food menu need to prepared for ${event.name} at ${venue.name}. The menu is ${event.food_req}`
                })}]
            })
        }else if(status.toLowerCase()==='rejected'){
            await alertProducer.send({
                topic: 'alert',
                
                messages: [{value: JSON.stringify({
                    email: event_org.email,
                    subject:`Your request to book ${venue.name} has been rejected`,
                    text:`${venue.name} has been rejected for booking for "${event.name}" from ${event.from_date} to ${event.to_date} at ${event.time}. Sorry for the inconvinience`
                })}]
            })
        }
        // if reject send mail to event organisers 
        log.message = `venue booking with id ${id} updated to ${status}`
        res.json(Response(200, 'Success', `Venue ${status} for event`))
    } catch (error) {
        console.log(error);
        log.message = `error in updating venue booking with id ${req.params.id}}`
        res.status(500).json(Response(500, 'Error', error))
    }
    // log to db using kafka producer
    await logProducer.send({
        topic: 'log',
        messages: [
            { value: JSON.stringify(log) }
        ]
    })
    return;
})

// get booking updates 
app.get('/venues/booking/details',async(req,res)=>{
    try {
        const {event_id,booking_id} = req.query
        let booking_data;
        if(event_id){
            const query = "select * from aicte.bookings where event_id = ? allow filtering"
            booking_data = (await db.execute(query,[event_id])).rows[0]
        }else{
            const query = "select * from aicte.bookings where id = ?"
            booking_data = (await db.execute(query,[booking_id])).rows[0]
        }
        return res.json(Response(200, 'Success', booking_data))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
})

// get all bookings of venue 
app.get('/venues/bookings/:id',async(req,res)=>{
    try {
        const {id} = req.params
        const query = "select * from aicte.bookings where venue_id = ? allow filtering"
        const data = (await db.execute(query,[id])).rows
        // console.log("data",data);
        const result = []
        for (let index = 0; index < data.length; index++) {
            const event = (await db.execute("select * from aicte.events where id = ?",[data[index].event_id])).rows[0]
            result.push({event,booking:data[0]})
        }
        // await data.forEach(async(booking)=>{
        //     // console.log(booking,booking.id.toString());
        // })
        // console.log(result);
        return res.json(Response(200, 'Success', result))
    } catch (error) {
        console.log(error);
        return res.status(500).json(Response(500, 'Error', error))
    }
})



app.listen(process.env.PORT);

console.log(`Venue Server Up!!`);