/* global $ */
var editor; // コードエディット時のeditorオブジェクト

var template_cache = {};

var show_gpu_meter = function(){
    _.each(gpus, function(gpu){
        var iframe = document.createElement('iframe');
        iframe.width = 228;
        iframe.height = 228;
        iframe.frameBorder = 0;
        iframe.style.cssText = 'border: none';
        var url = '/static/html/gpu_usage.html?';
        var keys = Object.keys(gpu);
        var uuid = '';
        _.each(keys, function(key){
            if(key == 'uuid') uuid = gpu[key];
            url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(gpu[key]);
        });
        url = url.replace('?&', '?');
        iframe.src = url;
        $('#' + uuid).append($(iframe));
    });
};

$('input[name=select_how_to_indicate_dataset], #fileInput').on('change', function(e){
    validate_setting_dataset();
    var selection = $('input[name=select_how_to_indicate_dataset]:checked').val();
    if(selection == 'upload') {
        $('#upload_dataset').removeClass('hidden');
        $('#set_dataset_path_div').addClass('hidden');
    } else {
        $('#upload_dataset').addClass('hidden');
        $('#set_dataset_path_div').removeClass('hidden');
    }
});

var validate_setting_dataset = function(){
    var is_valid_input = true;
    if(!/^[\w][\w|\ |\-]*$/.test($('#dataset_name_input').val())) is_valid_input = false;
    var selection = $('input[name=select_how_to_indicate_dataset]:checked').val() || null;
    if(selection == 'upload') {
        if(!$('#fileInput')[0].files[0]) is_valid_input = false;
    } else if(selection == 'set_path') {
        if(!/^[\w\/\.\-][\w\/\.\-/s]*$/.test($('#set_dataset_path_input').val())) is_valid_input = false;
    } else {
        is_valid_input = false;
    }
    if(is_valid_input) {
        $('#submit_dataset').removeClass('disabled');
    } else {
        $('#submit_dataset').addClass('disabled');
    }
};

$('#dataset_name_input, #set_dataset_path_input').on('keyup', function(e){
    validate_setting_dataset();
});

$('#uploadDataset #submit_dataset').on('click', function(e){
    if($('#submit_dataset').hasClass('disabled')) return;
    if($("input[name=select_how_to_indicate_dataset]:checked").val() == 'upload') {
        $('#upload_modal').modal('hide');
        $('#uploading_progress_div').removeClass('hidden');
        $('body').addClass('noscroll');
        var fd = new FormData();
        fd.append('dataset_name', $('#uploadDataset #dataset_name_input').val());
        fd.append('dataset_type', $('#uploadDataset input[name=dataset_type]:checked').val());
        fd.append('fileInput', $('#uploadDataset #fileInput').prop('files')[0]);
        $.ajax({
            async: true,
            xhr: function(){
                XHR = $.ajaxSettings.xhr();
                if(XHR.upload){
                    XHR.upload.addEventListener('progress', function(e){
                        var progress_rate = ~~(parseInt(e.loaded/e.total*10000, 10)/100) ;
                        $('#progress-bar')
                            .attr('aria-valuenow', progress_rate)
                            .css('width', progress_rate + '%')
                            .html('<span class="sr-only">' + progress_rate +'% Complete</span>');
                        $('#progress_rate').text(progress_rate + '%');
                    }, false);
                }
                return XHR;
            },
            url: "/api/dataset/upload",
            type: "POST",
            data: fd,
            contentType: false,
            processData: false
        })
        .done(function(ret){
            if(ret.status == 'error') {
                console.log(ret.message);
                $('#uploading_progress_div').addClass('hidden');
                $('body').removeClass('noscroll');
                alert('Could not upload Dataset.');
                return;
            }
            location.reload();
        })
        .fail(function(jqXHR, textStatus, errorThrown){
            console.log(errorThrown);
            $('#uploading_progress_div').addClass('hidden');
            $('body').removeClass('noscroll');
            alert('Could not upload Dataset.');
        });
    } else {
        var dataset_name = $('#dataset_name_input').val();
        var dataset_path = $('#set_dataset_path_input').val();
        var dataset_type = $('#uploadDataset input[name=dataset_type]:checked').val();
        $.post('/api/dataset/set_path',{
            dataset_path: dataset_path,
            dataset_name: dataset_name,
            dataset_type: dataset_type
        }, function(result){
            if(result.status == 'error') {
                alert(result.message + ' :' + result.path);
                return;
            }
            $('#upload_modal').modal('hide');
            location.reload();
        })
        .fail(function(jqXHR, textStatus, errorThrown){
            alert(errorThrown);
            return
        });
    }
});

var check_train_progress = function(){
    $.get('/api/models/check_train_progress', function(ret){
        _.each(ret.progress, function(p){
            var target = $('#model_' + p.id);
            switch(p.is_trained) {
                case 0:
                    target.removeAttr('class').addClass('model model-nottrained');
                    target.find('.progress-info').html('<span class="label label-nottrained">Not Trained</span>');
                    break
                case 1:
                    target.removeAttr('class').addClass('model model-progress');
                    target.find('.progress-info').html('<span class="label label-progress">In Progress</span>');
                    break;
                case 2:
                    target.removeAttr('class').addClass('model');
                    target.find('.progress-info').html('<span class="label label-trained">Trained</span>');
                    break;
                default:
                    break;
            }
        });
    });
};

$('#uploading_progress_div').on('click', function(e){
    e.preventDefault();
});

$('.datasets').on('click','.dataset', function(e){
    var dataset_id = $(this).data('id');
    location.href = '/dataset/show/' + dataset_id;
});

$('#dataset_more').on('click',function(){
    if ($(this).hasClass('disabled')) return;
    $(this).addClass('disabled');
    $(this).text('Loading...');
    var offset = $(this).attr('data-offset');
    $.get('/api/dataset/get/' + offset + '/', function(ret){
        new_offset = parseInt(offset, 10) + 3;
        if(parseInt(ret.dataset_count, 10) <= new_offset) {
            $('#dataset_more').addClass('hidden');
        } else {
            $('#dataset_more').attr('data-offset', new_offset);
        }
        var datasets_row = $('<div class="datasets_row">')
        _.each(ret.datasets, function(d){
            var out = '';
            if(d.type == 'image') {
                if(!template_cache.image_dataset_template) {
                    template_cache['image_dataset_template'] = _.template($('#image_dataset_template').text());
                }
                out = template_cache.image_dataset_template(d);
            } else if (d.type == 'text') {
                if(!template_cache.text_dataset_template) {
                    template_cache['text_dataset_template'] = _.template($('#text_dataset_template').text());
                }
                out = template_cache.text_dataset_template(d);
            }
            datasets_row.append($(out));
        });
        $('#dataset_more').before(datasets_row);
        $('#dataset_more').removeClass('disabled');
        $('#dataset_more').text('more');
    });

});

$('.text_detail').on('click', function(e){
    var filepath = $(this).data('path');
    var dataset_path = $(this).data('datasetpath')
    $.get('/api/dataset/' + $('#dataset_id').val() + '/get/text/full' + filepath, function(ret){
        _.each($('.btn_delete_text'), function(btn){
            $(btn).attr('data-path', filepath);
            $(btn).attr('data-datasetpath', dataset_path);
        });
        $('#text_detail').html(ret.text);
        $('#show_text_detail_modal').modal('show');
    });
});

$('.category').on('click', function(e){
    var path = $(this).data('path');
    var dataset_id = $(this).data('id');
    if(path.indexOf('/') !== 0) path = '/' + path
    location.href = '/dataset/show/' + dataset_id + path;
});

$('.category-image, .btn_delete_text').on('click', function(e){
    if(window.confirm('Is it okay to remove this file?')) {
        var form_input = '<input type="hidden" name="file_path" value="'+ $(this).data('path') +'">';
        var form = $('<form action="/dataset/' + $("#dataset_id").val() + '/remove/file' + $(this).data('datasetpath') + '" method="POST">' + form_input + '</form>');
        $('body').append(form);
        form.submit();
    }
});

$('#btn_delete_category').on('click', function(e){
    var dataset_type = $(this).data('type');
    var confirm_message = 'Is it okay to remove this category? Files will be also removed.';
    if(dataset_type == 'text') {
        confirm_message = 'Is it okay to remove this folder? Files will be also removed.';
    }
    if(window.confirm(confirm_message)) {
        var form_input = '<input type="hidden" name="category_path" value="'+ $(this).data('path') +'">';
        var form = $('<form action="/dataset/remove/' + $("#dataset_id").val() + '/category/" method="POST">' + form_input + '</form>');
        $('body').append(form);
        form.submit();
    }
});

$('#input_category_name').on('keyup', function(e){
    var category_name = $(this).val();
    if(/^[a-zA-A0-9][\w-_]*$/.test(category_name) && categories.indexOf(category_name) < 0) {
        $('#create_category_submit').removeClass('disabled');
    } else {
        $('#create_category_submit').addClass('disabled');
    }
});

$('#create_category_submit').on('click', function(e){
    $.post('/dataset/' + $('#dataset_id').val() + '/create/category/', {category_name: $('#input_category_name').val()}, function(ret){
        location.reload();
    });
});

$('#btn_delete_dataset').on('click', function(e){
    if(window.confirm('Is it okay to remove this Dataset? Files will be also removed.')) {
        location.href = '/dataset/remove/' + $('#dataset_id').val();
    }
});

$('#model_template_list').on('change', function(e){
    var model_name = $(this).val();
    $.get('/api/models/get/model_template/' + model_name, function(ret){
        var now = moment().format('YYYYMMDDHHmmss');
        $('#model_name_input').val(now + model_name);
        $('#network_name_input').val(model_name);
        $('#network_edit_area').val(ret.model_template);
        var model_lines = ret.model_template.split("\n");
        var hint = '';
        var is_chainer = false;
        var is_tensorflow = false;
        for(var i = 0, l = model_lines.length; i < l; i++) {
            if(/#\s*HINT\s*:/.test(model_lines[i])){
                hint = model_lines[i].split(':');
                hint = hint[1].trim();
            }
            if(/import\s+chainer/.test(model_lines[i])) {
                is_chainer = true;
            }
            if(/import\s+tensorflow/.test(model_lines[i])) {
                is_tensorflow = true;
            }
        }
        if(hint == 'image') {
            $('#model_type_image').prop('checked', true);
            $('#model_type_text').prop('checked', false);
        } else if(hint == 'text') {
            $('#model_type_image').prop('checked', false);
            $('#model_type_text').prop('checked', true);
        }
        if(is_chainer) {
            $('#framework_chainer').prop('checked', true);
            $('#link_to_reference').html('<a href="http://docs.chainer.org/" target="_blank">Chainer Reference</a>')
            $('#framework_tensorflow').prop('checked', false);
        }
        if(is_tensorflow) {
            $('#framework_chainer').prop('checked', false);
            $('#link_to_reference').html('<a href="https://www.tensorflow.org/api_docs" target="_blank">TensorFlow Reference</a>')
            $('#framework_tensorflow').prop('checked', true);
        }
        createEditor();
    });
});

$('#create_model_form').submit(function(){
    if(!/^[\w-\.]+$/.test($('#model_name_input').val())) {
        alert('Use Alphabet or Numbers on Model Name.')
        return false;
    }
    if(/^\s*$/.test($('#network_edit_area').val())){
        alert('Network definition is needed');
        return false;
    }
});

$('#create_model_reset').on('click',function(e){
    $('#model_name_input').val('');
    $('#network_name_input').val('');
    $('#algorithm_name_input').val('');
    $('#network_edit_area').val('');
    createEditor();
    $('#model_template_list').val('');
});

$('.model').on('click', function(e){
    if($(this).hasClass('model-nottrained')) {
        location.href = '/models/show/' + $(this).data('modelid');
    } else {
        location.href = '/models/show/' + $(this).data('modelid') + '#result';
    }
});

$('#epoch_select').on('keypress, change', function(e){
    var current_val = parseInt($(this).val(), 10);
    console.log(current_val);
    $('#epoch_on_modal').val(current_val);
    $('#epoch_on_modal_title').text("Epoch:" + current_val);
});

$('#start_train_btn').on('click', function(e){
    var model_id = $('#model_id').val();
    var dataset_id = parseInt($('#select_dataset').val(), 10);
    if(dataset_id < 0) {
        alert('Select Dataset.');
        return;
    }
    var epoch = $('#epoch_input').val();
    var pretrained_model = $('#select_pretrainedmodel').val() == -1 ? 'New' : $('#select_pretrainedmodel').val();
    var resize_mode = $('#select_resize_mode').val();
    var color_mode = $('#select_color_mode').val();
    var channels = 1;
    if(color_mode == "rgb"){
        channels = 3;
    }
    var flipping_mode = $('#select_flipping_mode').val();
    var model_type = $(this).data('modeltype');
    var use_wakatigaki = $('#use_wakachigaki').prop('checked') ? 1 : 0;
    var gpu_num = $('#gpu_num').val() || $('input[name="gpu_num"]:checked').val();
    var batchsize = $('#batchsize_input').val()

    $('#start_train_modal').modal('hide');
    $('#processing_screen').removeClass('hidden');

    var formData = new FormData();
    formData.append("model_id", model_id);
    formData.append("dataset_id", dataset_id);
    formData.append("epoch", epoch);
    formData.append("gpu_num", gpu_num);
    formData.append("batchsize", batchsize);
    formData.append("resize_mode",resize_mode);
    formData.append("channels", channels);
    formData.append("avoid_flipping",flipping_mode);
    formData.append("pretrained_model", pretrained_model);
    formData.append("model_type",model_type);
    formData.append("use_wakatigaki", use_wakatigaki);

    $.ajax({
           url: "/api/models/start/train",
           data: formData,
           method: "POST",
           processData: false,
           contentType: false,
    }).done(function(ret){
        if(ret.status === "OK") {
            $('#processing_screen').addClass('hidden');
            $('#start_train_div').addClass('hidden');
            $('#resume_train_div').addClass('hidden');
            $('#model_detail_buttons').addClass('hidden');
            $('span.label.label-nottrained')
                .removeClass('label-nottrained')
                .addClass('label-progress')
                .text('In Progress');
            $('span.label.label-trained')
                .removeClass('label-trained')
                .addClass('label-progress')
                .text('In Progress');
            $('#terminate_train_button').removeClass('hidden');
            $('#delete_model_button').addClass('hidden');
            $('#epoch_info').text(epoch);
            $('#dataset_name_info').text(ret.dataset_name);
            showResultScreen();
            location.hash = "result";
            return;
        }
        console.log(ret.traceback);
        alert('Failed to start train.');
        $('#processing_screen').addClass('hidden');
        return;

    }).fail(function(ret){
            alert('Failed to start train.');
            $('#processing_screen').addClass('hidden');
    });

});

$('#resume_train_btn').on('click', function(e){
    var model_id = $('#model_id').val();
    var gpu_num = $('#gpu_num').val() || $('input[name="gpu_num"]:checked').val();
    $('#resume_train_modal').modal('hide');
    $('#processing_screen').removeClass('hidden');

    var formData = new FormData();
    formData.append("model_id", model_id);
    formData.append("gpu_num", gpu_num);
    $.ajax({
           url: "/api/models/resume/train",
           data: formData,
           method: "POST",
           processData: false,
           contentType: false,
    }).done(function(ret){
        console.log(ret)
        if(ret.status === "OK") {
            $('#processing_screen').addClass('hidden');
            $('#start_train_div').addClass('hidden');
            $('#resume_train_div').addClass('hidden');
            $('#model_detail_buttons').addClass('hidden');
            $('span.label.label-nottrained')
                .removeClass('label-nottrained')
                .addClass('label-progress')
                .text('In Progress');
            $('span.label.label-trained')
                .removeClass('label-trained')
                .addClass('label-progress')
                .text('In Progress');
            $('#terminate_train_button').removeClass('hidden');
            $('#delete_model_button').addClass('hidden');
            $('#dataset_name_info').text(ret.dataset_name);
            showResultScreen();
            location.hash = "result";
            return;
        }
        console.log(ret.traceback);
        alert('Failed to resume train.');
        $('#processing_screen').addClass('hidden');
        return;

    }).fail(function(ret){
            alert('Failed to resume train.');
            $('#processing_screen').addClass('hidden');
    });

});

$('#delete_model_button').on('click', function(e){
    if(window.confirm('Is it okay to remove this model?')) {
        var model_id = $('#model_id').val();
        var form_input = '<input type="hidden" name="model_id" value="'+ model_id +'">';
        var form = $('<form action="/api/models/remove" method="POST">' + form_input + '</form>');
        $('body').append(form);
        form.submit();
    }
});

$('#terminate_train_button').on('click', function(e){
    if(window.confirm('Is it okay to terminate this trainning?')) {
        var model_id = $('#model_id').val();
        $('#processing_screen').find('.processing_subject').text('Waiting for terminate...')
        $('#processing_screen').removeClass('hidden');
        $.post('/api/models/terminate/train/', {id: model_id}, function(ret){
            $('#processing_screen').addClass('hidden');
            if(ret.status == 'success') {
                alert('Successfully terminated');
                location.reload();
            }
        });
    }
})

$('#processing_screen').on('click', function(e){
    e.stopPropagation();
});

$('#trained_model_download').on('click', function(e){
    var form_input = '<input type="hidden" name="epoch" value="' + $('#epoch_select').val() + '">';
    form_input += '<input type="hidden" name="model_id" value="' + $('#model_id').val() + '">';
    var form = $('<form action="/api/models/download/files/" method="POST">' + form_input + '</form>');
    $('body').append(form);
    form.submit();
});

$('#graph_tab').on('click', function(e){
    $(this).addClass('active');
    $('#model_detail_graph').removeClass('hidden');
    $('#network_tab').removeClass('active');
    $('#layer_tab').removeClass('active');
    $('#log_tab').removeClass('active');
    $('#model_detail_log').addClass('hidden');
    $('#model_detail_network').addClass('hidden');
    $('#model_detail_layers').addClass('hidden');
});

$('#network_tab').on('click', function(e){
    $(this).addClass('active');
    $('#model_detail_network').removeClass('hidden');
    $('#model_detail_graph').addClass('hidden');
    $('#model_detail_layers').addClass('hidden');
    $('#model_detail_log').addClass('hidden');
    $('#graph_tab').removeClass('active');
    $('#layer_tab').removeClass('active');
    $('#log_tab').removeClass('active');
});

$('#layer_tab').on('click', function(e){
    if($(this).hasClass('disabled')) return;
    $(this).addClass('active');
    $('#model_detail_network').addClass('hidden');
    $('#model_detail_graph').addClass('hidden');
    $('#model_detail_layers').removeClass('hidden');
    $('#model_detail_log').addClass('hidden');
    $('#log_tab').removeClass('active');
    $('#graph_tab').removeClass('active');
    $('#network_tab').removeClass('active');
});

$('#viz_layer_submit').on('click', function(e){
    $('#viz_layer_select_layer').empty();
    $.get('/api/models/' + $('#model_id').val() + '/get/layer_names/' + $('#viz_layer_epoch').val() , function(ret){
        if(ret.status == 'error') {
            alert(ret.message);
            return;
        }
        _.each(ret.layers, function(layer){
            var option = $('<option value="' + layer.name.replace(/\//g, '_') + '">' + layer.name + ' ' + layer.params + '</option>' );
            $('#viz_layer_select_layer').append(option);
        });
        $('#viz_layer_select_layer_wrap').removeClass('hidden');
    });
});

var showing_layers = [];

$('#viz_layer_select_layer_submit').on('click', function(e){
    $('#viz_layer_loading').removeClass("hidden");
    $.get('/api/models/'+ $('#model_id').val() + '/get/layer_viz/' + $('#viz_layer_epoch').val() + '/' + $('#viz_layer_select_layer').val(),
    function(ret){
        if(ret.status == 'error') {
            alert(ret.message);
            $('#viz_layer_loading').addClass('hidden');
            return;
        }
        var image_path = '/layers/' + $('#model_id').val() + '/' + $('#viz_layer_epoch').val() + '/' + ret.filename;
        if(_.indexOf(showing_layers, image_path) > -1) {
            $('#viz_layer_loading').addClass('hidden');
            return;
        }
        var wrap = $('<div></div>');
        var title_epoch = $('<h4>Epoch: ' + ret.epoch + '</h4>');
        var layer = $('<img class="img-responsive" src="' + image_path +'">');
        showing_layers.push(image_path);
        wrap.append(title_epoch);
        wrap.append(layer);
        $('#viz_layer_result').prepend(wrap);
        $('#viz_layer_loading').addClass('hidden');
    });
});

$('#model_edit_cancel').on('click', function(e){
    $('#network_edit_area').text($('#original_network').text());
});

$('#create_new_network_modal').on('show.bs.modal', function(e){
    var original_name = $('#original_name').val();
    original_name = original_name.replace('.py', '');
    var temp_name_arr = original_name.split('_');
    if(/^\d+$/.test(temp_name_arr[temp_name_arr.length - 1])){
        var temp_index = parseInt(temp_name_arr.pop(), 10) + 1;
        temp_name_arr.push(temp_index);
    } else {
        temp_name_arr.push('1');
    }
    var name = temp_name_arr.join('_');
    $('#modal_create_network_name').val(name + '.py');
});

$('#network_edit_area').on('keydown', function(e){
    $('#create_network_buttons').removeClass('hidden');
});

$('#create_new_network_modal').on('show.bs.modal', function(e){
    $('#modal_create_network_my_network').val($('#network_edit_area').val());
});

$('#create_new_network_modal_form').submit(function(){
    if(!/^[\w-\.]+$/.test($('#modal_create_network_name').val())) {
        alert('Use Alphabet or Numbers on Model Name.')
        return false;
    }
    if(/^\s*$/.test($('#modal_create_network_my_network').val())){
        alert('Network definition is needed');
        return false;
    }
});

$('#prediction_epoch, #prediction_result_length, #prediction_primetext').on("change, keyup", function(e){
    var epoch = $('#prediction_epoch').val();
    var result_length = $('#prediction_result_length').val();
    var primetext = $('#prediction_primetext').val();
    var submit_ok = true;
    if(!/^\d+$/.test(epoch)) submit_ok = false;
    if(!/^\d+$/.test(result_length)) submit_ok = false;
    if(primetext == '') submit_ok = false;
    if(submit_ok) {
        $('#do_predict').removeClass('disabled');
    } else {
        $('#do_predict').addClass('disabled');
    }
});

$('#do_predict').on('click', function(e){
    if($('#do_predict').hasClass('disabled')) return;
    var model_id = $('#model_id').val();
    var epoch = $('#prediction_epoch').val();
    var result_length = $('#prediction_result_length').val();
    var primetext = $('#prediction_primetext').val();

    $.post('/api/models/lstm/generate_text/', {
        model_id: model_id,
        epoch: epoch,
        result_length: result_length,
        primetext: primetext
    }, function(ret){
        if (ret.error) {
            alert(ret.error)
        } else {
            $('#prediction_result').text('');
            $('#prediction_result').text(ret.result);
        }
    });
});


$('#log_tab').on('click', function(e){
    $(this).addClass('active');
    $('#model_detail_log').removeClass('hidden');
    $('#model_detail_network').addClass('hidden');
    $('#model_detail_graph').addClass('hidden');
    $('#model_detail_layers').addClass('hidden');
    $('#graph_tab').removeClass('active');
    $('#layer_tab').removeClass('active');
    $('#network_tab').removeClass('active');
});

var update_graph = function() {
     var model_id = $('#model_id').val();
     $.get('/api/models/' + model_id + '/get/train_data/graph/', function(ret){
         if(ret.status != 'ready') return;
         if(ret.data.indexOf('perplexity') > -1) {
             drawLSTMResultGraph(ret.data);
         } else {
             drawImagenetResultGraph(ret.data);
         }
     });
}

var update_train_log = function(){
    var model_id = $('#model_id').val();
    $.get('/api/models/' + model_id + '/get/train_data/log/', function(ret){
        if(ret.status != 'ready') return;
        $('#training_log').html(ret.data)
    });
}

var subscribe_train_log = function() {
    var model_id = $('#model_id').val();
    function LogSubscriber() {};
    LogSubscriber.prototype = {
        connect: function() {
            this.graphTSV = "";
            this.log = [];
            this.timeStamps = [];
            this.startTime = null;
            this.currentEpoch = 1;
            this.trainCount = 0;
            // おおよそ何回の更新でエポックが終わるか
            this.numberOfUpdateCountPerEpoch = 0;
            this.needUpdateGraph = false;
            this.needUpdateLog = false;

            if (this.timer) {
                clearInterval(this.timer);
            }
            var url = '/api/models/' + model_id + '/get/train_data/log/subscribe';
            var stream = new EventSource(url);

            stream.addEventListener('message', function(e) {
                var obj = JSON.parse(e.data);
                if (obj.type == 'end') {
                    console.log(obj);
                    location.reload();
                    return;
                }
                if (obj.type == 'log') {
                    this.pushLog(obj.data);
                } else if (obj.type == 'graph') {
                    this.pushGraph(obj.data);
                }
            }.bind(this));
            this.stream = stream;
            this.timer = setInterval(function() {
                if (this.stream.readyState == 2) {
                    this.connect();
                }
                this.displayUpdateIfNeeded();
            }.bind(this), 1000);
        },
        // このメソッドはEventStreamで一行追記された時に呼ばれます。
        // 学習を再開した場合もログが一行ずつ送られてきます。
        pushLog: function(data) {
            var obj = JSON.parse(data);
            this.log.push(obj)
            this.needUpdateLog = true;
            // dataが来たらそれまでのlogを捨てる。
            if (obj.type == 'data') {
                this.log = _.filter(this.log, function(logJSON) {
                    return logJSON.type != 'log';
                });
            }
            if (obj.time_stamp && obj.epoch) {
                this.trainCount += 1;
                var momentTime = moment(obj.time_stamp, 'YYYY-MM-DD HH:mm:ss');
                this.startTime = this.startTime || momentTime;
                if (this.currentEpoch < obj.epoch) {
                    this.numberOfUpdateCountPerEpoch = this.trainCount;
                    this.trainCount = 0
                }
                this.currentEpoch = obj.epoch;

                this.timeStamps.push(momentTime);
                if (this.timeStamps.length > 10) {
                    this.timeStamps.shift()
                }
            }
        },
        pushGraph: function(data) {
            this.graphTSV += data;
            this.needUpdateGraph = true;
        },
        displayUpdateIfNeeded: function() {
            if (this.needUpdateLog) {
                this.logDisplayUpdate();
                this.needUpdateLog = false;
            }
            if (this.needUpdateGraph) {
                this.graphDisplayUpdate();
                this.needUpdateGraph = false;
            }
        },
        graphDisplayUpdate: function() {
            if(this.graphTSV.indexOf('perplexity') > -1) {
                drawLSTMResultGraph(this.graphTSV);
            } else {
                drawImagenetResultGraph(this.graphTSV);
            }
        },
        logDisplayUpdate: function() {
            var text = _.map(this.log, function(logData) {
                var body = logData[logData.type];
                return body;
            });
            $('#training_log').html(text.join('<br>'));
            if (this.startTime) {
                var latest = this.timeStamps[this.timeStamps.length - 1];
                $('#time_spent').text(millisec_to_readable_time(latest.diff(this.startTime)));
            }
            if(this.startTime && this.epochStartTime || this.currentEpoch > 1){
                var target_epoch = parseInt($('#epoch_info').text(), 10);
                var first = this.timeStamps[0];
                var last = this.timeStamps[this.timeStamps.length - 1];
                // 吐き出されるtime stampの最近10回の平均
                var timeSpan = last.diff(first) / (this.timeStamps.length - 1);

                // 一回あたりのupdate時間　* (エポック毎のupdate回数 * (目的のエポック数 - 既に終わったエポック数) - 学習中のエポックのupdate回数)
                var remain_time = timeSpan * (this.numberOfUpdateCountPerEpoch * (target_epoch - (this.currentEpoch - 1)) - this.trainCount)
                $('#remain_time').text(millisec_to_readable_time(remain_time));
            }
        }
    };
    var subscriber = new LogSubscriber();
    subscriber.connect();
}

var update_remain_time = function(train_log){
    var start_time, latest_time, current_epoch, end_time;
    var does_one_epoch_spent = false;
    lines = train_log.split('<br>');
    _.each(lines, function(line){
        if(/\[TIME\]/.test(line)) {
            var temp = line.replace('[TIME]', '').split(',');
            var temp_time = moment(temp[1], 'YYYY-MM-DD HH:mm:ss');
            var temp_epoch = parseInt(temp[0], 10);

            if(!start_time) start_time = temp_time;
            if(!latest_time) latest_time = temp_time;

            if(current_epoch < temp_epoch) {
                end_time = latest_time;
            }
            latest_time = temp_time;
            current_epoch = temp_epoch;
        }
    });
    if(start_time && latest_time) {
        $('#time_spent').text(millisec_to_readable_time(latest_time.diff(start_time)));
    }
    if(!start_time || !end_time || current_epoch == 1) return;
    var target_epoch = parseInt($('#epoch_info').text(), 10);
    $('#remain_time').text(millisec_to_readable_time((end_time.diff(start_time) / (current_epoch - 1)) * (target_epoch - current_epoch)));
};

var millisec_to_readable_time = function(millisec){
    var d = String(Math.floor(millisec / 86400000) + 100).substring(1);
    var h = String(Math.floor((millisec - parseInt(d, 10) * 86400000)/ 3600000) + 100).substring(1);
    var m = String(Math.floor((millisec - parseInt(d, 10) * 86400000 - parseInt(h, 10) * 3600000)/60000)+ 100).substring(1);
    var s = String(Math.round((millisec - parseInt(d, 10) * 86400000 - parseInt(h, 10) * 3600000 - parseInt(m, 10) * 60000)/1000)+ 100).substring(1);
    return d+' days '+h+':'+m+':'+s;
};

var increase_time_spent = function(){
    var current = $('#time_spent').text();
    var times = current.split(':');
    var days = times[0].split(' days ');
    var sec = parseInt(days[0], 10) * 60 * 60 * 24 + parseInt(days[1], 10) * 60 * 60 + parseInt(times[1], 10) * 60 + parseInt(times[2], 10);
    sec += 1;
    $('#time_spent').text(millisec_to_readable_time(sec * 1000));
};

var decrease_time_remain = function(){
    var current = $('#remain_time').text();
    var times = current.split(':');
    if(times.length != 3) return;
    var days = times[0].split(' days ');
    var sec = parseInt(days[0], 10) * 60 * 60 * 24 + parseInt(days[1], 10) * 60 * 60 + parseInt(times[1], 10) * 60 + parseInt(times[2], 10);
    sec -= 1;
    if(sec < 0) {
        $('#remain_time').text('0 days 00:00:00');
    } else {
        $('#remain_time').text(millisec_to_readable_time(sec*1000));
    }
};

var drawLSTMResultGraph = function(data){
    var margin = {top: 20, right: 20, bottom: 30, left: 50};

    var path = xAxisGroup = yAxisGroup = null;
    if (!document.getElementById('graph_svg')) {
        $('#training_graph').empty();
        var svg = d3.select("#training_graph")
            .append('svg')
            .attr('width', 630)
            .attr('height', 460)
            .append('g')
            .attr('id', 'graph_svg')
            .attr("transform", "translate(0,0)");

        path = svg.append("path")
            .attr("id", "path")
            .attr("class", "line-loss")
            .attr("transform", "translate(" + margin.left + ",0)")

        // x axis(epoch)
        xAxisGroup = svg.append("g")
            .attr("id", "x-axis")
            .attr("class", "x axis")
            .attr("fill", "white")
            .attr("transform", "translate(" + margin.left + ",410)")
        // y axis right side(perplexity)
        yAxisGroup = svg.append("g")
            .attr("id", "y-axis")
            .attr("class", "y axis")
            .attr("transform", "translate(" + margin.left + ",0)")
            .attr("fill", "white")
        // legend
        var legend_data = [
            {title: "Perplexity", color:"steelblue"},
        ];
        _.each(legend_data, function(d, i){
            addLegend(svg, d.title, d.color, i);
        });
    } else {
        path = d3.select('#path')
        xAxisGroup = d3.select('#x-axis')
        yAxisGroup = d3.select('#y-axis')
    }
    var width = 550 - margin.left - margin.right;
    var height = 450 - margin.top - margin.bottom;

    var xEpoch      = d3.scale.linear().range([0, width]);
    var xCount      = d3.scale.linear().range([0, width]);
    var yPerplexity = d3.scale.linear().range([height, 0]);
    var parsedData = d3.tsv.parse(data, function(row) {
        row.epoch = parseInt(row.epoch, 10) + 1;
        row.count = parseInt(row.count, 10);
        return row;
    });
    xEpoch.domain(d3.extent(parsedData, function(d) { return d.epoch }));
    xCount.domain(d3.extent(parsedData, function(d) { return d.count }));
    yPerplexity.domain([0, d3.max(parsedData).perplexity]);
    // 軸の定義
    var xAxis          = d3.svg.axis()
                         .scale(xEpoch)
                         .orient("bottom")
                         .innerTickSize(-height)
                         .outerTickSize(0)
                         .tickPadding(10);
    var yAxisPerplexity = d3.svg.axis().scale(yPerplexity).orient("left");

    // 線の定義
    var linePerplexity = d3.svg.line()
            .x(function(d) { return xCount(d.count); })
            .y(function(d) { return yPerplexity(d.perplexity); });

    // loss
    path.datum(parsedData).attr("d", linePerplexity);
    // x axis(epoch)
    xAxisGroup.call(xAxis);
    // y axis right side(perplexity)
    yAxisGroup.call(yAxisPerplexity)
};

var drawImagenetResultGraph = function(data){
    // スケールと出力レンジの定義
    var margin = {top: 20, right: 20, bottom: 30, left: 50};
    var width = 550 - margin.left - margin.right;
    var height = 450 - margin.top - margin.bottom;

    var xEpoch       = d3.scale.linear().range([0, width]);
    var xCount       = d3.scale.linear().range([0, width]);
    var yLoss        = d3.scale.linear().range([height, 0]);
    var yValLoss     = d3.scale.linear().range([height, 0]);
    var yAccuracy    = d3.scale.linear().range([height, 0]);
    var yValAccuracy = d3.scale.linear().range([height, 0]);

    var lossPath = accuracyPath = lossValPath = accuracyValPath = xAxisGroup = yAxisLeftSide = yAxisRightSide = null;
    if (!document.getElementById('graph_svg')) {
        $('#training_graph').empty();
        var svg = d3.select("#training_graph")
            .append('svg')
            .attr('width', 630)
            .attr('height', 460)
            .append('g')
            .attr('id', 'graph_svg')
            .attr("transform", "translate(0,0)");
        // loss
        lossPath = svg.append("path")
            .attr("class", "line-loss")
            .attr("transform", "translate(" + margin.left + ",0)")
        // accuracy
        accuracyPath = svg.append("path")
            .attr("class", "line-accuracy")
            .attr("transform", "translate(" + margin.left + ",0)")
        // loss(val)
        lossValPath = svg.append("path")
            .attr("class", "line-val-loss")
            .attr("transform", "translate(" + margin.left + ",0)")
        // accuracy(val)
        accuracyValPath = svg.append("path")
            .attr("class", "line-val-accuracy")
            .attr("transform", "translate(" + margin.left + ",0)")
        // x axis(epoch)
        xAxisGroup = svg.append("g")
            .attr("id", "x-axis")
            .attr("class", "x axis")
            .attr("fill", "white")
            .attr("transform", "translate(" + margin.left + ",410)")
        // y axis left side(loss)
        yAxisLeftSide = svg.append("g")
            .attr("id", "y-axis-left")
            .attr("class", "y axis")
            .attr("transform", "translate(" + margin.left + ",0)")
            .attr("fill", "white")
        yAxisLeftSide.append("text")
            .attr("y", 6)
            .attr("x", 5)
            .attr("dy", ".71em")
            .attr("fill", "white")
            .style("text-anchor", "start")
            .text("loss");
        // y axis right side(accuracy)
        yAxisRightSide = svg.append("g")
            .attr("id", "y-axis-right")
            .attr("class", "y axis")
            .attr("transform", "translate(" + (width + margin.left + 10)+",0)")
            .attr("fill", "white")
        yAxisRightSide.append("text")
            .attr("y", 6)
            .attr("x", -5)
            .attr("dy", ".71em")
            .attr("fill", "white")
            .style("text-anchor", "end")
            .text("accuracy")
        // legend
        var legend_data = [
            {title: "loss", color:"steelblue"},
            {title: "accuracy", color:"orange"},
            {title: "loss(val)", color:"#0c0"},
            {title: "accuracy(val)", color:"red"}
        ];
        _.each(legend_data, function(d, i){
            addLegend(svg, d.title, d.color, i);
        });
    } else {
        lossPath = d3.select('.line-loss')
        accuracyPath = d3.select('.line-accuracy')
        lossValPath = d3.select('.line-val-loss')
        accuracyValPath = d3.select('.line-val-accuracy')
        xAxisGroup = d3.select('#x-axis')
        yAxisLeftSide = d3.select('#y-axis-left')
        yAxisRightSide = d3.select('#y-axis-right')
    }

    // 軸の定義
    var xAxis         = d3.svg.axis()
                        .scale(xEpoch)
                        .orient("bottom")
                        .innerTickSize(-height)
                        .outerTickSize(0)
                        .tickPadding(10);
    var yAxisLoss     = d3.svg.axis().scale(yLoss).orient("left");
    var yAxisAccuracy = d3.svg.axis().scale(yAccuracy).orient("right");

    // 線の定義
    var lineLoss = d3.svg.line()
            .x(function(d) { return xCount(d.count); })
            .y(function(d) { return yLoss(d.loss); });
    var lineValLoss = d3.svg.line()
            .x(function(d) { return xCount(d.count)})
            .y(function(d) { return yValLoss(d.val_loss)});
    var lineAccuracy = d3.svg.line()
            .x(function(d) { return xCount(d.count); })
            .y(function(d) { return yAccuracy(d.accuracy); });
    var lineValAccuracy = d3.svg.line()
            .x(function(d) { return xCount(d.count); })
            .y(function(d) { return yValAccuracy(d.val_accuracy); });

    var parsedData = d3.tsv.parse(data, function(){
        var count = -1;
        return function(data){
            count++;
            var SAMPLING_RATE = 10;
            if(!data['loss(val)'] && count % SAMPLING_RATE != 0) return;
            data.count = count;
            data.epoch = +data.epoch;
            data.loss = data.loss ? +data.loss : null;
            data.accuracy = data.accuracy ? +data.accuracy : null;
            data.val_loss = data['loss(val)'] ? +data['loss(val)'] : null;
            data.val_accuracy = data['accuracy(val)'] ? +data['accuracy(val)'] : null;
            return data;
        };
    }());

    var train_accuracy_data = _.filter(parsedData, function(obj){
        if(obj.accuracy) return true;
    });
    var train_loss_data = _.filter(parsedData, function(obj){
        if(obj.loss) return true;
    });
    var val_accuracy_data = _.filter(parsedData, function(obj){
        if(obj.val_accuracy) return true;
    });
    var val_loss_data = _.filter(parsedData, function(obj){
        if(obj.val_loss) return true;
    });

    xEpoch.domain(d3.extent(parsedData, function(d) { return d.epoch }));
    xCount.domain(d3.extent(parsedData, function(d) { return d.count }));
    var loss_max = d3.max(train_loss_data.concat(val_loss_data), function(d){ return d.loss || d.val_loss});
    yLoss.domain([0, loss_max]);
    yAccuracy.domain([0, 1]);
    yValLoss.domain([0, loss_max]);
    yValAccuracy.domain([0, 1]);

    lossPath.datum(train_loss_data).attr("d", lineLoss);
    accuracyPath.datum(train_accuracy_data).attr("d", lineAccuracy);
    lossValPath.datum(val_loss_data).attr("d", lineValLoss);
    accuracyValPath.datum(val_accuracy_data).attr("d", lineValAccuracy);
    xAxisGroup.call(xAxis);
    yAxisLeftSide.call(yAxisLoss)
    yAxisRightSide.call(yAxisAccuracy)
};

var addLegend = function(svg, title, color, i){
    var legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', 'translate(0,' + (14*i+5) + ')');
    legend.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .style('fill', color);
    legend.append('text')
        .attr('x', 14)
        .attr('y', 10)
        .attr("font-size", ".8em")
        .attr('fill', color)
        .style('text-anchor', 'start')
        .text(title);
};

var createEditor = function(){
    $('.CodeMirror').remove();
    if($('#network_edit_area').prop('tagName') == 'TEXTAREA') {
        editor = CodeMirror.fromTextArea(document.getElementById('network_edit_area'),{
            mode: "python",
            lineNumbers: true,
            indentUnit: 4
        });
    } else {
        var code = $('#network_edit_area').text();
        $('#network_edit_area').empty();
        editor = CodeMirror(document.getElementById('network_edit_area'), {
            mode: "python",
            lineNumbers: true,
            indentUnit: 4,
            readOnly: true,
            value: code
        });
    }
    editor.on("change", function(){
        editor.save();
        $('#create_network_buttons').removeClass('hidden');
    });
    if(editor.save) editor.save();
};

var showResultScreen = function(){
        if($('#graph_tab').is('*')) {
            $('#network_tab').removeClass('active');
            $('#log_tab').removeClass('active');
            $('#layer_tab').removeClass('active');
            $('#graph_tab').addClass('active');
            $('#model_detail_network').addClass('hidden');
            $('#model_detail_log').addClass('hidden');
            $('#model_detail_layers').addClass('hidden');
            $('#model_detail_graph').removeClass('hidden');
        } else {
            $('#network_tab').removeClass('active');
            $('#log_tab').addClass('active');
            $('#layer_tab').removeClass('active');
            $('#model_detail_network').addClass('hidden');
            $('#model_detail_log').removeClass('hidden');
            $('#model_detail_layers').addClass('hidden');
        }
};


// Admin

$('.admin_dataset_delete').on('click', function(e){
    location.href = '/admin/datasets/remove/' + $(this).data('datasetid');
});
