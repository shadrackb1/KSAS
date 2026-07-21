import { uploadJSONToCloudinary } from './src/lib/cloudinary';

uploadJSONToCloudinary('test.json', { hello: 'world' }).then(console.log).catch(console.error);
