// import React, { useState, useEffect } from 'react';
// import { Plus, Edit, Trash2, AlertTriangle } from 'react-icons/fa';
// import toast from 'react-hot-toast';
// import api from '../../services/api';
// import Layout from '../Layout/Layout';

// const Products = () => {
//   const [products, setProducts] = useState([]);
//   const [showModal, setShowModal] = useState(false);
//   const [editingProduct, setEditingProduct] = useState(null);
//   const [formData, setFormData] = useState({
//     product_code: '',
//     name: '',
//     purchase_price: '',
//     selling_price: '',
//     current_stock: '',
//     min_stock_level: '5'
//   });

//   useEffect(() => {
//     fetchProducts();
//   }, []);

//   const fetchProducts = async () => {
//     try {
//       const response = await api.get('/products');
//       setProducts(response.data);
//     } catch (error) {
//       toast.error('Failed to fetch products');
//     }
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       if (editingProduct) {
//         await api.put(`/products/${editingProduct.id}`, formData);
//         toast.success('Product updated successfully');
//       } else {
//         await api.post('/products', formData);
//         toast.success('Product added successfully');
//       }
//       fetchProducts();
//       setShowModal(false);
//       resetForm();
//     } catch (error) {
//       toast.error(error.response?.data?.error || 'Operation failed');
//     }
//   };

//   const handleDelete = async (id) => {
//     if (window.confirm('Are you sure you want to delete this product?')) {
//       try {
//         await api.delete(`/products/${id}`);
//         toast.success('Product deleted successfully');
//         fetchProducts();
//       } catch (error) {
//         toast.error('Failed to delete product');
//       }
//     }
//   };

//   const handleUpdateStock = async (id, quantity, type) => {
//     try {
//       await api.patch(`/products/${id}/stock`, { quantity, type });
//       toast.success('Stock updated successfully');
//       fetchProducts();
//     } catch (error) {
//       toast.error('Failed to update stock');
//     }
//   };

//   const resetForm = () => {
//     setFormData({
//       product_code: '',
//       name: '',
//       purchase_price: '',
//       selling_price: '',
//       current_stock: '',
//       min_stock_level: '5'
//     });
//     setEditingProduct(null);
//   };

//   return (
//     <Layout>
//       <div className="p-6">
//         <div className="flex justify-between items-center mb-6">
//           <h1 className="text-2xl font-bold">Products</h1>
//           <button
//             onClick={() => setShowModal(true)}
//             className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600"
//           >
//             <Plus /> Add Product
//           </button>
//         </div>

//         <div className="bg-white rounded-lg shadow overflow-x-auto">
//           <table className="min-w-full">
//             <thead className="bg-gray-50">
//               <table>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price</th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price</th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
//               </tr>
//             </thead>
//             <tbody className="bg-white divide-y divide-gray-200">
//               {products.map((product) => (
//                 <tr key={product.id}>
//                   <td className="px-6 py-4 whitespace-nowrap">{product.product_code}</td>
//                   <td className="px-6 py-4">{product.name}</td>
//                   <td className="px-6 py-4">₹{product.purchase_price}</td>
//                   <td className="px-6 py-4">₹{product.selling_price}</td>
//                   <td className="px-6 py-4">
//                     <div className="flex items-center gap-2">
//                       <span className={product.current_stock <= product.min_stock_level ? 'text-red-600 font-bold' : ''}>
//                         {product.current_stock}
//                       </span>
//                       {product.current_stock <= product.min_stock_level && (
//                         <AlertTriangle className="text-red-500" />
//                       )}
//                       <div className="flex gap-1">
//                         <button
//                           onClick={() => handleUpdateStock(product.id, 1, 'add')}
//                           className="bg-green-500 text-white px-2 py-1 rounded text-xs"
//                         >
//                           +1
//                         </button>
//                         <button
//                           onClick={() => handleUpdateStock(product.id, 1, 'remove')}
//                           className="bg-red-500 text-white px-2 py-1 rounded text-xs"
//                         >
//                           -1
//                         </button>
//                       </div>
//                     </div>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <button
//                       onClick={() => {
//                         setEditingProduct(product);
//                         setFormData(product);
//                         setShowModal(true);
//                       }}
//                       className="text-blue-600 hover:text-blue-900 mr-3"
//                     >
//                       <Edit />
//                     </button>
//                     <button
//                       onClick={() => handleDelete(product.id)}
//                       className="text-red-600 hover:text-red-900"
//                     >
//                       <Trash2 />
//                     </button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>

//         {/* Modal for Add/Edit Product */}
//         {showModal && (
//           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//             <div className="bg-white rounded-lg p-6 w-full max-w-md">
//               <h2 className="text-xl font-bold mb-4">
//                 {editingProduct ? 'Edit Product' : 'Add Product'}
//               </h2>
//               <form onSubmit={handleSubmit}>
//                 <div className="space-y-4">
//                   <input
//                     type="text"
//                     placeholder="Product Code"
//                     value={formData.product_code}
//                     onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
//                     className="w-full px-3 py-2 border rounded-lg"
//                     required
//                   />
//                   <input
//                     type="text"
//                     placeholder="Product Name"
//                     value={formData.name}
//                     onChange={(e) => setFormData({ ...formData, name: e.target.value })}
//                     className="w-full px-3 py-2 border rounded-lg"
//                     required
//                   />
//                   <input
//                     type="number"
//                     placeholder="Purchase Price"
//                     value={formData.purchase_price}
//                     onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
//                     className="w-full px-3 py-2 border rounded-lg"
//                     required
//                   />
//                   <input
//                     type="number"
//                     placeholder="Selling Price"
//                     value={formData.selling_price}
//                     onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
//                     className="w-full px-3 py-2 border rounded-lg"
//                     required
//                   />
//                   <input
//                     type="number"
//                     placeholder="Current Stock"
//                     value={formData.current_stock}
//                     onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
//                     className="w-full px-3 py-2 border rounded-lg"
//                   />
//                   <input
//                     type="number"
//                     placeholder="Min Stock Level"
//                     value={formData.min_stock_level}
//                     onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
//                     className="w-full px-3 py-2 border rounded-lg"
//                   />
//                 </div>
//                 <div className="flex justify-end gap-3 mt-6">
//                   <button
//                     type="button"
//                     onClick={() => {
//                       setShowModal(false);
//                       resetForm();
//                     }}
//                     className="px-4 py-2 border rounded-lg hover:bg-gray-50"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     type="submit"
//                     className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
//                   >
//                     {editingProduct ? 'Update' : 'Add'}
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         )}
//       </div>
//     </Layout>
//   );
// };

// export default Products;