'use strict';
const express = require('express');
const uuid = require('uuid');
const { connectDB,db } = require('./db');
const { Response , alertProducer, logProducer} = require('./helpers');

const app = express();

// parse req body as json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// routes for events

// get all events 
app.get('/events', async (req, res) => {
    try {
        // const user = JSON.parse(req.headers.user)
        const query = 'select * from aicte.events'
        const data = (await db.execute(query,[])).rows 
        return res.status(200).json(Response(200, 'Success', data))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
})

// get venue 
app.get('/events/:id', async (req, res) => {
    try {
        const query = 'select * from aicte.events where id = ?'
        const data = (await db.execute(query,[req.params.id])).rows[0]
        return res.status(200).json(Response(200, 'Success', data))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
});


// register venue 
app.post('/events',async (req, res) => {
    const user = JSON.parse(req.headers.user)
    const log = {
        type:"event_register",
        message:"",
        user_id:user.id,
        user_name:user.name
    }
    try {
        const { name,description,caption,status,from_date,to_date,time,image,organiser,food_req,expected_count } = req.body
        if (!(name && description && caption && status && from_date && to_date && time && image && organiser && food_req && expected_count)) {
            return res.status(400).json(Response(400, 'Bad Request', 'Please fill all the fields'))
        }
        const id = uuid.v4()
        const timestamp = new Date().toISOString()
        const query = 'insert into aicte.events (id,name,description,caption,status,from_date,to_date,time,image,organiser,food_req,expected_count,createdat,updatedat) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        await db.execute(query,[id,name,description,caption,status,from_date,to_date,time,image,organiser,food_req,expected_count,timestamp,timestamp])
        log.message = `created event ${name} with id ${id}`
        await logProducer.send({
            topic:"notify",
            messages:[{value:JSON.stringify({
                user_id:user.id,
                message:`Created Event ${name}`
            })}]
        })
        const msg = {
            email:user.email,
            subject:`Created Event ${name}`,
            text:`Successfully created event ${name}. Please continue to the portal for venue booking and management.`,
        }
        await alertProducer.send({
            topic: "alert",
            messages: [{value:JSON.stringify(msg)}],
        })
        res.status(200).json(Response(200, 'Success', { id, name, description, caption, status, from_date, to_date, time, image,organiser,food_req,expected_count, createdat: timestamp, updatedat: timestamp }))
    }
    catch (error) {
        log.message = "error in registering event"
        res.status(500).json(Response(500, 'Error', error))
    }
    // log to db using kafka producer
    await logProducer.send({
        topic: "log",
        messages: [{value:JSON.stringify(log)}],
    })
    return;
});
// update event status 
app.put('/events/:id/status',async(req,res)=>{
    const user = JSON.parse(req.headers.user)
    const log = {
        type:"event_update",
        message:"",
        user_id:user.id,
        user_name:user.name
    }
    try{
        const {status} = req.body 
        const q = 'update aicte.events set status = ? where id = ?'
        await db.execute(q,[status,req.params.id])
        log.message = `updated event status with id ${req.params.id}`
        res.json(Response(200,'success',"event status updated"))
    }catch(error){
        log.message = "error in updating event with id "+req.params.id
        res.status(500).json(Response(500, 'Error', error))
    }
     // log to db using kafka producer
     await logProducer.send({
        topic: "log",
        messages: [{value:JSON.stringify(log)}],
    })
    return;
})
// update venue details
app.put('/events/:id', async (req, res) => {
    const user = JSON.parse(req.headers.user)
    const log = {
        type:"event_update",
        message:"",
        user_id:user.id,
        user_name:user.name
    }
    try {
        const { name,description,caption,status,from_date,to_date,time,image,organiser,food_req } = req.body
        if (!(name && description && caption && status && from_date && to_date && time && image && organiser && food_req)){
            return res.status(400).json(Response(400, 'Bad Request', 'Please fill all the fields'))
        }
        const timestamp = new Date().toISOString()
        const update_event = `update aicte.events set name = ?,description = ?,caption = ?,status = ?,from_date = ?,to_date = ?,food_req = ?,time = ?,image = ?,organiser = ?,updatedat = ? where id = ?`
        await db.execute(update_event,[name,description,caption,status,from_date,to_date,food_req,time,image,organiser,timestamp,req.params.id])
        log.message = `updated event ${name} with id ${req.params.id}`
        res.json(Response(200, 'Success', "Event updated successfully"))
    }
    catch (error) {
        log.message = "error in updating event with id "+req.params.id
        res.status(500).json(Response(500, 'Error', error))
    }
    // log to db using kafka producer
    await logProducer.send({
        topic: "log",
        messages: [{value:JSON.stringify(log)}],
    })
    return;
});

// delete venue
app.delete('/events/:id', async (req, res) => {
    const user = JSON.parse(req.headers.user)
    const log = {
        type:"event_delete",
        message:"deleted event with id "+req.params.id,
        user_id:user.id,
        user_name:user.name
    }
    try {
        const delete_venue = `delete from aicte.events where id = ?`
        await db.execute(delete_venue,[req.params.id])
        log.type = "delete"
        res.json(Response(200, 'Success', "Event deleted successfully"))
    }
    catch (error) {
        log.message = "error in deleting event with id "+req.params.id
        res.status(500).json(Response(500, 'Error', error))
    }
    // log to db using kafka producer
    await logProducer.send({
        topic: "log",
        messages: [{value:JSON.stringify(log)}],
    })
    return;
})

// invite user to event 
app.post('/events/:id/invite', async (req, res) => {
    const user_in = JSON.parse(req.headers.user)
    const log = {
        type:"event_invite",
        message:"",
        user_id:user_in.id,
        user_name:user_in.name
    }
    try{
        const event_id = req.params.id
        const event = (await db.execute('select * from aicte.events where id = ?',[event_id])).rows[0] 
        let {users,departments} = req.body
        if(!departments){
            return res.json(Response(400,"Error","Empty fields!"))
        }
        console.log(req.body);
        // booking and venue details for mail
        const booking = (await db.execute('select * from aicte.bookings where event_id = ? allow filtering',[event.id])).rows[0]
        const venue = (await db.execute('select * from aicte.venues where id = ?',[booking.venue_id])).rows[0]
        
        const query = 'insert into aicte.invites (id,event_id,user_id,name,email,phone,createdat,updatedat) values (?,?,?,?,?,?,?,?)'
        // invite by departments 
        await departments.forEach(async(dept)=>{
            const users_depts = (await db.execute('select * from aicte.users where department = ? allow filtering',[dept])).rows
            for (let i = 0; i < users_depts.length; i++) {
                const ele = users_depts[i];
                const timestamp = new Date().toISOString()
                const invite_id = uuid.v4()
                // find user 
                const find_user = `select * from aicte.invites where user_id = ? and event_id = ? allow filtering`
                const user_data = (await db.execute(find_user,[ele.id,event_id])).rows
                console.log(ele.email,ele.phone);
                if (user_data.length > 0) return;
                await db.execute(query,[invite_id,event_id,ele.id,ele.name,ele.email,ele.phone,timestamp,timestamp])
                const msg = {
                    email:ele.email,
                    subject:`Invite for ${event.name}`,
                    text:`You have been invited to ${event.name} on ${event.from_date} at ${event.time} Venue details are as follows: ${venue.name} ${venue.address} ${venue.city} ${venue.state} ${venue.pincode} website: ${venue.website}`,
                }
                await alertProducer.send({
                    topic: "alert",
                    messages: [{value:JSON.stringify(msg)}],
                })
                await alertProducer.send({
                    topic:"sms",
                    messages:[{
                        value:JSON.stringify({
                            phone:ele.phone,
                            text:`You have been invited to ${event.name} on ${event.from_date} at ${event.time} Venue details are as follows: ${venue.name} ${venue.address} ${venue.city} ${venue.state} ${venue.pincode} website: ${venue.website}`
                        })
                    }]
                })
                await logProducer.send({
                    topic:"notify",
                    messages:[{value:JSON.stringify({
                        user_id:ele.id,
                        message:`You have been invited to ${event.name}.Please check invited events for more details.`
                    })}]
                })
            }
            
        })
        if (users) {
            users = JSON.parse(users)
            // only email of users for mass mail
            const emails = []
            const phones = []

            // save to db 
            await users.forEach(async (user)=>{
                emails.push(user.email)
                phones.push(user.phone)
                const timestamp = new Date().toISOString()
                const invite_id = uuid.v4()
                // find user 
                const find_user = `select * from aicte.invites where user_id = ? and event_id = ? allow filtering`
                const user_data = (await db.execute(find_user,[user.id,event_id])).rows
                // console.log(user);
                if (user_data.length > 0) return;
                await db.execute(query,[invite_id,event_id,user.id,user.name,user.email,user.phone,timestamp,timestamp])
                await logProducer.send({
                    topic:"notify",
                    messages:[{value:JSON.stringify({
                        user_id:user.id,
                        message:`You have been invited to ${event.name}.Please check invited events for more details.`
                    })}]
                })
            })
           
            // send mail to every invited user using kafka producer
            // if invites are more than 50 then send mail in batches of 50
            if (emails.length > 50) {
                const batches = Math.ceil(emails.length/50)
                for (let i = 0; i < batches; i++) {
                    // slice emails array into batches of 50 
                    let batch;
                    if((i+1)*50 > emails.length)
                        batch = emails.slice(i*50,emails.length)
                    else
                        batch = emails.slice(i*50,(i+1)*50)
    
                    const msg = {
                        email:batch,
                        subject:`Invite for ${event.name}`,
                        text:`You have been invited to ${event.name} on ${event.from_date} at ${event.time} Venue details are as follows: ${venue.name} ${venue.address} ${venue.city} ${venue.state} ${venue.pincode} website: ${venue.website}`,
                    }
                    await alertProducer.send({
                        topic: "mass_mail",
                        messages: [{value:JSON.stringify(msg)}],
                    })
                }
            }else{
                const msg = {
                    email:emails,
                    subject:`Invite for ${event.name}`,
                    text:`You have been invited to ${event.name} on ${event.from_date} at ${event.time} Venue details are as follows: ${venue.name} ${venue.address} ${venue.city} ${venue.state} ${venue.pincode} website: ${venue.website}`,
                }
                await alertProducer.send({
                    topic: "mass_mail",
                    messages: [{value:JSON.stringify(msg)}],
                })
            }
            // send sms to every invited user using kafka producer
            phones.forEach(async(phone) => {
                await alertProducer.send({
                    topic:"sms",
                    messages:[{
                        value:JSON.stringify({
                            phone:phone,
                            text:`You have been invited to ${event.name} on ${event.from_date} at ${event.time} Venue details are as follows: ${venue.name} ${venue.address} ${venue.city} ${venue.state} ${venue.pincode} website: ${venue.website}`
                        })
                    }]
                })
            });
        }
        
        log.message = `invited users to event with id ${event_id}`
        res.json(Response(200, 'Success', "Invites sent successfully"))
    }catch(err){
        console.log(err);
        log.message = "error in inviting users to event with id "+req.params.id
        res.status(500).json(Response(500, 'Error', err))
    }
    // log to db using kafka producer
    await logProducer.send({
        topic: "log",
        messages: [{value:JSON.stringify(log)}],
    })
    return;
})
// assign tasks to users 
app.post('/events/assigntasks',async(req,res)=>{
    try {
        let {event_id,tasks} = req.body
        tasks = JSON.parse(tasks)
        if(!(event_id&&tasks)){
            return res.status(400).json(Response(400, 'Bad Request', 'Please fill all the fields'))
        }
        const event = (await db.execute('select * from aicte.events where id = ?',[event_id])).rows[0]
        await tasks.forEach(async(task)=>{
            const id = uuid.v4()
            const timestamp = new Date().toISOString()
            const query = "insert into aicte.event_tasks (id,event_id,user_id,user_name,user_email,task,createdat) values (?,?,?,?,?,?,?)"
            await db.execute(query,[id,event_id,task.id,task.name,task.email,task.task,timestamp])
            // email 
            await alertProducer.send({
                topic: 'alert',
                messages: [{value: JSON.stringify({
                    email: task.email,
                    subject:`Your tasks for event ${event.name}`,
                    text:`Your task is to ${task.task}`
                })}]
            })
            // notify 
            await logProducer.send({
                topic:"notify",
                messages:[{value:JSON.stringify({
                    user_id:task.id,
                    message:`You have been assigned task for ${event.name}.`
                })}]
            })
        })
        return res.status(200).json(Response(200,"success","Tasks assigned sucessfully"))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
})
app.post('/events/feedback',async(req,res)=>{
    try {
        const {event_id,user_id,user_name,user_email,overall,venue,coordination,canteen,suggestion} = req.body
        if(!(event_id&&user_id&&user_name&&user_email&&overall&&venue&&coordination&&canteen&&suggestion)){
            return res.status(400).json(Response(400, 'Bad Request', 'Please fill all the fields'))
        }
        const event = (await db.execute('select * from aicte.events where id = ?',[event_id])).rows[0]
        const timestamp = new Date().toISOString()
        const query = "insert into aicte.feedbacks (id,event_id,user_id,user_name,user_email,overall,venue,coordination,canteen,suggestion,createdat) values (?,?,?,?,?,?,?,?,?,?,?)"
        await db.execute(query,[uuid.v4(),event_id,user_id,user_name,user_email,overall,venue,coordination,canteen,suggestion,timestamp])
        alertProducer.send({
            topic: 'alert',
            messages: [{value: JSON.stringify({
                email: user_email,
                subject:`Feedback submitted for event ${event.name}!`,
                text:`Hi! ${user_name} your feedback for event ${event.name} has been received. Thank you for your valuable feedback.`
            })}]
        })
        return res.status(200).json(Response(200,"success","Feedback submitted successfully"))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
})

app.get('/events/feedback/:id',async(req,res)=>{
    try {
        const {id} = req.params
        if(!id){
            return res.status(400).json(Response(400, 'Bad Request', 'Please fill all the fields'))
        }
        const feedback = (await db.execute('select * from aicte.feedbacks where event_id = ? allow filtering',[id])).rows
        return res.status(200).json(Response(200,"success",feedback))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
})
// get tasks of events 
app.get('/events/tasks/event/:id',async(req,res)=>{
    console.log("req.query");
    try{
        const query = "select * from aicte.event_tasks where event_id = ? allow filtering"
        const data = (await db.execute(query,[req.params.id])).rows
        return res.json(Response(200,'success',data))
       

    }catch(error){
        console.log(error);
        return res.status(500).json(Response(500, 'Error', error)) 
    }
})
// get tasks of events by user 
app.get('/events/tasks/user/:id',async(req,res)=>{
    try{
            // get tasks by user 
            const query = 'select * from aicte.event_tasks where user_id = ? allow filtering'
            const result = []
            const user_tasks = (await db.execute(query,[req.params.id])).rows
            for (let index = 0; index < user_tasks.length; index++) {
                const event = (await db.execute('select * from aicte.events where id = ?',[user_tasks[index].event_id])).rows[0]
                result.push({event,task:user_tasks[index].task})
            }
            console.log(result);
            return res.json(Response(200,'success',result))
    }catch(error){
        console.log(error);
        return res.status(500).json(Response(500, 'Error', error)) 
    }
})

// get invited users for event 
app.get('/events/:id/invites', async (req, res) => {
    try {
        const query = 'select * from aicte.invites where event_id = ? allow filtering'
        const data = (await db.execute(query,[req.params.id])).rows
        return res.status(200).json(Response(200, 'Success', data))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
})

// get events for users who are invited to event
app.get('/events/invited/:user_id', async (req, res) => {
    try {
        const query = 'select * from aicte.invites where user_id = ? allow filtering'
        const data = (await db.execute(query,[req.params.user_id])).rows
        // find events from id's of events
        const find_events = 'select * from aicte.events where id = ?'
        const events = await Promise.all(data.map(async ({event_id})=>{
            const event = (await db.execute(find_events,[event_id])).rows[0]
            return event
        }))
        return res.status(200).json(Response(200, 'Success', events))
    } catch (error) {
        return res.status(500).json(Response(500, 'Error', error))
    }
})

app.listen(process.env.PORT);

console.log(`Events Server Up!!`);