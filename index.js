const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dovum.mongodb.net/?retryWrites=true&w=majority`;

// const uri = "mongodb+srv://computer-admin:<password>@cluster0.dovum.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        await client.connect();
        const productCollection = client.db('computer_world').collection('products');

        const orderCollection = client.db('computer_world').collection('orders');
        const userCollection = client.db('computer_world').collection('users');
        const reviewCollection = client.db('computer_world').collection('reviews');


        app.get('/products', async (req, res) => {
            const dscSort = { _id: -1 }
            const query = {};
            const cursor = productCollection.find(query);
            const products = await cursor.sort(dscSort).toArray();
            res.send(products);

        });

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const productDetails = await productCollection.findOne(query);
            res.send(productDetails);
        });

        app.put('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updatedQuantity = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {

                    quantity: updatedQuantity.quantity,

                },
            };
            const productUpdate = await productCollection.updateOne(filter, updatedDoc, options);
            res.send(productUpdate);

        });

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const productDelete = await productCollection.deleteOne(query);
            res.send(productDelete);
        });


        app.post('/orders', async (req, res) => {
            const doctor = req.body;
            const result = await orderCollection.insertOne(doctor);
            res.send(result);
        });


        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const productDelete = await orderCollection.deleteOne(query);
            res.send(productDelete);
        });

        app.get('/myorder', verifyJWT, async (req, res) => {
            const email = req.query.email;

            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const dscSort = { _id: -1 };
                const query = { email: email };
                const cursor = orderCollection.find(query);
                const products = await cursor.sort(dscSort).toArray();
                res.send(products);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }


        });

        app.get('/payment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const productDetails = await orderCollection.findOne(query);
            res.send(productDetails);
        });


        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        app.get('/orders', async (req, res) => {
            const dscSort = { _id: -1 }
            const query = {};
            const cursor = orderCollection.find(query);
            const products = await cursor.sort(dscSort).toArray();
            res.send(products);

        });

        //Payment id related && Shipped related use here
        // Checkoutform and AllOrders Component
        app.patch('/order/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: payment.status,
                    // transactionId: payment.transactionId
                }
            }

            // const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedBooking);
        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
            res.send({ result, token });
        })

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });


        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }

        });




        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })



        app.post('/addproduct', async (req, res) => {
            const product = req.body;
            const addProduct = await productCollection.insertOne(product);
            res.send(addProduct);
        });



        app.post('/reviews', async (req, res) => {
            const doctor = req.body;
            const result = await reviewCollection.insertOne(doctor);
            res.send(result);
        });


        app.get('/reviews', async (req, res) => {
            const dscSort = { _id: -1 }
            const result = await reviewCollection.find().sort(dscSort).toArray();
            res.send(result);
        });




    }
    finally {

    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello From Computer World!')
})

app.listen(port, () => {
    console.log(`Computer World App listening on port ${port}`)
})
