const express = require('express');
var jwt = require('jsonwebtoken');
const app = express()
const cors = require('cors');
require('dotenv').config()
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)
const morgan = require('morgan')
const port = process.env.PORT || 5000;
const { ObjectId } = require('mongodb');
const { MongoClient, ServerApiVersion } = require('mongodb');

// Middleware 
app.use(express.json())
app.use(cors())
app.use(morgan('tiny'))

//MongoDB starts here


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ywgzzs0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// jwt middleware function 
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' })
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized access' })
        }
        else {
            req.decoded = decoded;
            next()
        }
    })

}
async function run() {
    try {
        const usersCollenction = client.db('linguaDb').collection('users')
        const classCollection = client.db('linguaDb').collection('classes')
        const enrollCollection = client.db('linguaDb').collection('enrolls')
        const cartCollection = client.db('linguaDb').collection('carts')

        // create json web token
        app.post('/jwt', async (req, res) => {
            const email = req.body;
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1hr',
            })


            res.send({ token })
            //**send token as object */
        })

        // save user in database
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const query = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user
            }
            const result = await usersCollenction.updateOne(query, updateDoc, options)

            res.send(result)
        })

        // find the role of a user
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollenction.findOne(query);
            res.send(result)
        })

        // Add a class to mongodb 
        app.post('/classes', async (req, res) => {
            const classInfo = req.body;


            const updatedClassInfor = {
                ...classInfo,
                status: 'pending'
            }

            const result = await classCollection.insertOne(updatedClassInfor)
            res.send(result)
        })

        // find all classes
        app.get('/classes', async (req, res) => {
            const status = req.query.status;
            const query = status ? { status } : {}
            const result = await classCollection.find(query).toArray()
            res.send(result)
        })

        // get all classes of an instructor
        app.get('/classes/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbiddedn Access' })
            }
            const query = {
                'instructorInfo.email': email
            }
            console.log(query);
            const result = await classCollection.find(query).toArray();
            res.send(result)
        })
        app.put('/classes/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const result = await classCollection.updateOne(
                    { classId: classId },
                    { $set: { status: 'approved' } }
                );
                res.json({ success: true, message: 'Status updated to approved' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        })
        // delete an instructor specific class
        app.delete('/classes/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) }
            const result = await classCollection.deleteOne(query)
            res.send(result)
        })

        // put a selected class in cartCollection
        app.post('/cart', async (req, res) => {
            const enrollInfo = req.body;
            const uniqueId = new ObjectId();
            enrollInfo._id = uniqueId;

            const existingEnrollment = await cartCollection.findOne(
                {
                    classId: enrollInfo.classId,
                    "userInfo.email": enrollInfo.userInfo.email
                }

            );

            if (existingEnrollment) {
                res.status(400).json({ error: 'You have already enrolled for this class.' });

            } else {
                const result = await cartCollection.insertOne(enrollInfo)
                res.status(200).json(result);
            }

        })

        // Get all the selected classes from cartCollection
        app.get('/cart', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }
            const query = { "userInfo.email": email }
            const result = await cartCollection.find(query).toArray()
            res.send(result)
        })
        // delete a selected item from cartCollection
        app.delete('/selectedClass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })
        // post paid class info to the mongodb
        app.post('/enrolled', async (req, res) => {
            const paymentInfo = req.body;

            const result = await enrollCollection.insertOne(paymentInfo)
            res.send(result)
        })
        // get enrolled class list
        app.get('/enrolled', async (req, res) => {
            const email = req.query.email;
            console.log(email);
            // if (!email) {
            //     res.send([])
            // }
            const query = { "userInfo.email": email }
            const result = await enrollCollection.find(query).sort({ sortedDate: -1 }).toArray()
            res.send(result)
        })

        // PaymentIntent with the order amount
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            console.log(price);
            if (price) {
                const amount = parseFloat(price) * 100;
                console.log(amount);
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card']
                });

                res.send({
                    clientSecret: paymentIntent.client_secret
                })
            }


        })


        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        client.db("admin").command({ ping: 1 });
        console.log("Amazing! you just hit the MongoDB");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

// MongoDB ends here
app.get('/', (req, res) => {
    res.send('Lingua server is running')
})

app.listen(port, (req, res) => {
    console.log(`the server is running on ${port}`);
})